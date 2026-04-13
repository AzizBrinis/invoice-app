import { randomBytes, randomUUID } from "node:crypto";
import {
  modelSchema,
  type ModelName,
} from "@/lib/db/generated-schema";
import {
  DatabaseKnownRequestError,
  DatabaseUnknownRequestError,
} from "@/lib/db/errors";
import {
  dbSql,
  executeSqlFragment,
  executeStatement,
  quoteIdentifier,
  quoteQualifiedIdentifier,
  type DatabaseSqlClient,
  type SqlLikeFragment,
} from "@/lib/db/postgres";

type QueryArgs = Record<string, unknown>;

type RuntimeField = {
  name: string;
  kind: string;
  type: string;
  isList: boolean;
  isRequired: boolean;
  isUnique: boolean;
  isId: boolean;
  hasDefaultValue: boolean;
  default: unknown;
  isUpdatedAt: boolean;
  relationName: string | null;
  relationFromFields: readonly string[];
  relationToFields: readonly string[];
  relationOnDelete: string | null;
};

type RuntimeRelation = {
  fieldName: string;
  isList: boolean;
  name: string;
  owning: boolean;
  sourceFields: readonly string[];
  targetFields: readonly string[];
  targetModel: ModelName;
};

type RuntimeModel = {
  fields: Record<string, RuntimeField>;
  name: ModelName;
  primaryKey: readonly string[];
  relations: Record<string, RuntimeRelation>;
  scalarFields: string[];
  tableName: string;
  uniqueFields: readonly (readonly string[])[];
  updatedAtFields: readonly string[];
};

type QueryContext = {
  aliasCounter: number;
  values: unknown[];
};

const INTERNAL_REQUIRED_FIELDS = "__internalRequiredFields";

function createCuid() {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(12).toString("base64url").replace(/[^a-z0-9]/gi, "").toLowerCase();
  return `c${timestamp}${random.slice(0, 18)}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date) && !Buffer.isBuffer(value);
}

function toQueryArgs(value: unknown): QueryArgs {
  return isPlainObject(value) ? value : {};
}

function toQueryArgRows(value: unknown): QueryArgs[] {
  if (Array.isArray(value)) {
    return value.filter(isPlainObject);
  }

  return isPlainObject(value) ? [value] : [];
}

function toNumberOrUndefined(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

function hasQueryWhere(value: unknown) {
  return isPlainObject(value) && Object.keys(value).length > 0;
}

function cloneValue<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  return structuredClone(value);
}

function serializeKey(values: unknown[]) {
  return JSON.stringify(values.map((value) => (value instanceof Date ? value.toISOString() : value)));
}

function nextAlias(context: QueryContext, prefix = "t") {
  context.aliasCounter += 1;
  return `${prefix}${context.aliasCounter}`;
}

function quoteColumn(alias: string, fieldName: string) {
  return `${quoteIdentifier(alias)}.${quoteIdentifier(fieldName)}`;
}

function getModel(modelName: ModelName): RuntimeModel {
  return runtimeModels[modelName];
}

function getField(modelName: ModelName, fieldName: string): RuntimeField {
  const field = getModel(modelName).fields[fieldName];
  if (!field) {
    throw new Error(`Unknown field ${modelName}.${fieldName}`);
  }
  return field;
}

function parseDefaultValue(field: RuntimeField) {
  if (!field.hasDefaultValue) {
    return undefined;
  }

  if (field.default && typeof field.default === "object" && "name" in (field.default as Record<string, unknown>)) {
    const value = field.default as { name?: string };
    switch (value.name) {
      case "cuid":
        return createCuid();
      case "uuid":
        return randomUUID();
      case "now":
        return new Date();
      default:
        return undefined;
    }
  }

  if (field.type === "Json" && typeof field.default === "string") {
    try {
      return JSON.parse(field.default);
    } catch {
      return field.default;
    }
  }

  return cloneValue(field.default);
}

function isOperatorObject(value: Record<string, unknown>) {
  return [
    "equals",
    "in",
    "notIn",
    "lt",
    "lte",
    "gt",
    "gte",
    "contains",
    "startsWith",
    "endsWith",
    "mode",
    "not",
  ].some((key) => key in value);
}

function isFieldUpdateOperation(value: unknown): value is Record<string, unknown> {
  return (
    isPlainObject(value) &&
    ["set", "increment", "decrement", "multiply", "divide"].some((key) => key in value)
  );
}

function normalizeValueForStorage(field: RuntimeField, value: unknown) {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return null;
  }

  if (field.type === "Json") {
    return JSON.stringify(value);
  }

  return value;
}

function getCompoundFields(model: RuntimeModel, key: string) {
  const candidates = [
    model.primaryKey,
    ...model.uniqueFields,
  ].filter((fields) => fields.length > 1);

  return candidates.find((fields) => fields.join("_") === key) ?? null;
}

function pushParameter(
  context: QueryContext,
  field: RuntimeField | undefined,
  value: unknown,
) {
  const normalized = field ? normalizeValueForStorage(field, value) : value;
  context.values.push(normalized);
  const placeholder = `$${context.values.length}`;
  if (field?.type === "Json" && normalized !== null) {
    return `${placeholder}::jsonb`;
  }
  return placeholder;
}

function buildFieldComparison(
  modelName: ModelName,
  alias: string,
  fieldName: string,
  value: unknown,
  context: QueryContext,
): string {
  const field = getField(modelName, fieldName);
  const column = quoteColumn(alias, fieldName);

  if (value === null) {
    return `${column} IS NULL`;
  }

  if (!isPlainObject(value) || !isOperatorObject(value)) {
    return `${column} = ${pushParameter(context, field, value)}`;
  }

  const mode = value.mode === "insensitive" ? "insensitive" : "default";
  const operators: string[] = [];

  if ("equals" in value) {
    const equalsValue = value.equals;
    operators.push(
      equalsValue === null
        ? `${column} IS NULL`
        : `${column} = ${pushParameter(context, field, equalsValue)}`,
    );
  }

  if ("in" in value) {
    const list = Array.isArray(value.in) ? value.in : [];
    if (list.length === 0) {
      operators.push("FALSE");
    } else {
      const placeholders = list.map((item) => pushParameter(context, field, item)).join(", ");
      operators.push(`${column} IN (${placeholders})`);
    }
  }

  if ("notIn" in value) {
    const list = Array.isArray(value.notIn) ? value.notIn : [];
    if (list.length > 0) {
      const placeholders = list.map((item) => pushParameter(context, field, item)).join(", ");
      operators.push(`${column} NOT IN (${placeholders})`);
    }
  }

  const simpleComparisons: Array<[keyof typeof value, string]> = [
    ["lt", "<"],
    ["lte", "<="],
    ["gt", ">"],
    ["gte", ">="],
  ];
  for (const [operator, sqlOperator] of simpleComparisons) {
    if (!(operator in value)) {
      continue;
    }
    operators.push(
      `${column} ${sqlOperator} ${pushParameter(context, field, value[operator])}`,
    );
  }

  const likeOperator = mode === "insensitive" ? "ILIKE" : "LIKE";
  if ("contains" in value) {
    operators.push(
      `${column} ${likeOperator} ${pushParameter(context, field, `%${value.contains ?? ""}%`)}`,
    );
  }
  if ("startsWith" in value) {
    operators.push(
      `${column} ${likeOperator} ${pushParameter(context, field, `${value.startsWith ?? ""}%`)}`,
    );
  }
  if ("endsWith" in value) {
    operators.push(
      `${column} ${likeOperator} ${pushParameter(context, field, `%${value.endsWith ?? ""}`)}`,
    );
  }

  if ("not" in value) {
    const nested = buildFieldComparison(modelName, alias, fieldName, value.not, context);
    operators.push(`NOT (${nested})`);
  }

  return operators.length > 0 ? operators.map((entry) => `(${entry})`).join(" AND ") : "TRUE";
}

function buildRelationWhere(
  modelName: ModelName,
  alias: string,
  relation: RuntimeRelation,
  value: unknown,
  context: QueryContext,
): string {
  if (!isPlainObject(value)) {
    return "TRUE";
  }

  const relationAlias = nextAlias(context, relation.fieldName.slice(0, 1).toLowerCase() || "r");
  const joins = relation.targetFields.map((targetField, index) => {
    const sourceField = relation.sourceFields[index];
    return `${quoteColumn(relationAlias, targetField)} = ${quoteColumn(alias, sourceField)}`;
  });

  const joinPredicate = joins.length > 0 ? joins.join(" AND ") : "TRUE";
  const buildExists = (nestedWhere: unknown, negate = false) => {
    const nested = buildWhereSql(relation.targetModel, relationAlias, nestedWhere, context);
    const clause = `EXISTS (SELECT 1 FROM ${quoteQualifiedIdentifier("public", getModel(relation.targetModel).tableName)} ${quoteIdentifier(relationAlias)} WHERE ${joinPredicate} AND ${nested})`;
    return negate ? `NOT (${clause})` : clause;
  };

  if (relation.isList) {
    if ("some" in value) {
      return buildExists(value.some);
    }
    if ("none" in value) {
      return buildExists(value.none, true);
    }
    if ("every" in value) {
      const nested = buildWhereSql(relation.targetModel, relationAlias, value.every, context);
      return `NOT EXISTS (SELECT 1 FROM ${quoteQualifiedIdentifier("public", getModel(relation.targetModel).tableName)} ${quoteIdentifier(relationAlias)} WHERE ${joinPredicate} AND NOT (${nested}))`;
    }
    return buildExists(value);
  }

  if ("is" in value) {
    return buildExists(value.is);
  }
  if ("isNot" in value) {
    return buildExists(value.isNot, true);
  }

  return buildExists(value);
}

function buildWhereSql(
  modelName: ModelName,
  alias: string,
  where: unknown,
  context: QueryContext,
): string {
  if (!where || !isPlainObject(where) || Object.keys(where).length === 0) {
    return "TRUE";
  }

  const model = getModel(modelName);
  const clauses: string[] = [];

  for (const [key, value] of Object.entries(where)) {
    if (key === "AND") {
      const items = Array.isArray(value) ? value : [value];
      const nested = items.map((item) => buildWhereSql(modelName, alias, item, context));
      clauses.push(nested.length > 0 ? `(${nested.join(" AND ")})` : "TRUE");
      continue;
    }

    if (key === "OR") {
      const items = Array.isArray(value) ? value : [value];
      const nested = items.map((item) => buildWhereSql(modelName, alias, item, context));
      clauses.push(nested.length > 0 ? `(${nested.join(" OR ")})` : "FALSE");
      continue;
    }

    if (key === "NOT") {
      const items = Array.isArray(value) ? value : [value];
      const nested = items.map((item) => buildWhereSql(modelName, alias, item, context));
      clauses.push(nested.length > 0 ? `NOT (${nested.join(" AND ")})` : "TRUE");
      continue;
    }

    const relation = model.relations[key];
    if (relation) {
      clauses.push(buildRelationWhere(modelName, alias, relation, value, context));
      continue;
    }

    const compoundFields = getCompoundFields(model, key);
    if (compoundFields && isPlainObject(value)) {
      clauses.push(
        compoundFields
          .map((fieldName) =>
            buildFieldComparison(modelName, alias, fieldName, value[fieldName], context),
          )
          .join(" AND "),
      );
      continue;
    }

    clauses.push(buildFieldComparison(modelName, alias, key, value, context));
  }

  return clauses.length > 0 ? clauses.join(" AND ") : "TRUE";
}

function buildOrderBySql(
  modelName: ModelName,
  alias: string,
  orderBy: unknown,
  context: QueryContext,
) {
  if (!orderBy) {
    return "";
  }

  const items = Array.isArray(orderBy) ? orderBy : [orderBy];
  const clauses: string[] = [];
  const model = getModel(modelName);

  for (const item of items) {
    if (!isPlainObject(item)) {
      continue;
    }

    for (const [key, value] of Object.entries(item)) {
      if (value !== "asc" && value !== "desc" && !isPlainObject(value)) {
        continue;
      }

      const direction = (typeof value === "string" ? value : "asc").toUpperCase() as "ASC" | "DESC";
      const relation = model.relations[key];

      if (relation && isPlainObject(value) && !relation.isList) {
        const [[nestedField, nestedDirection]] = Object.entries(value);
        const relationAlias = nextAlias(context, key.slice(0, 1).toLowerCase() || "r");
        const joinPredicate = relation.targetFields
          .map((targetField, index) => `${quoteColumn(relationAlias, targetField)} = ${quoteColumn(alias, relation.sourceFields[index])}`)
          .join(" AND ");
        clauses.push(
          `(SELECT ${quoteColumn(relationAlias, nestedField)} FROM ${quoteQualifiedIdentifier("public", getModel(relation.targetModel).tableName)} ${quoteIdentifier(relationAlias)} WHERE ${joinPredicate} LIMIT 1) ${(typeof nestedDirection === "string" ? nestedDirection : "asc").toUpperCase()}`,
        );
        continue;
      }

      clauses.push(`${quoteColumn(alias, key)} ${direction}`);
    }
  }

  return clauses.length > 0 ? ` ORDER BY ${clauses.join(", ")}` : "";
}

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function buildDistinctSelectSql(
  modelName: ModelName,
  alias: string,
  args: QueryArgs,
  context: QueryContext,
) {
  const distinctFields = toStringArray(args.distinct);
  if (distinctFields.length === 0) {
    return {
      orderBySql: buildOrderBySql(modelName, alias, args.orderBy, context),
      selectPrefix: "SELECT",
    };
  }

  const model = getModel(modelName);
  for (const fieldName of distinctFields) {
    if (!model.fields[fieldName] || model.fields[fieldName].kind === "object") {
      throw new Error(`Unknown distinct field ${modelName}.${fieldName}`);
    }
  }

  const distinctSql = distinctFields
    .map((fieldName) => quoteColumn(alias, fieldName))
    .join(", ");
  const orderBySql = buildOrderBySql(modelName, alias, args.orderBy, context);
  if (!orderBySql) {
    return {
      orderBySql: ` ORDER BY ${distinctSql}`,
      selectPrefix: `SELECT DISTINCT ON (${distinctSql})`,
    };
  }

  const orderByBody = orderBySql.slice(" ORDER BY ".length);
  return {
    orderBySql: ` ORDER BY ${distinctSql}, ${orderByBody}`,
    selectPrefix: `SELECT DISTINCT ON (${distinctSql})`,
  };
}

function buildPaginationSql(skip?: number, take?: number, context?: QueryContext) {
  let sql = "";
  if (typeof take === "number") {
    if (!context) {
      throw new Error("Pagination requires a query context.");
    }
    context.values.push(take);
    sql += ` LIMIT $${context.values.length}`;
  }
  if (typeof skip === "number") {
    if (!context) {
      throw new Error("Pagination requires a query context.");
    }
    context.values.push(skip);
    sql += ` OFFSET $${context.values.length}`;
  }
  return sql;
}

function getRelationEntries(model: RuntimeModel, args: QueryArgs) {
  return [
    ...Object.entries(args.select ?? {}).filter(
      ([fieldName, enabled]) => model.relations[fieldName] && enabled,
    ),
    ...Object.entries(args.include ?? {}).filter(
      ([fieldName, enabled]) => model.relations[fieldName] && enabled,
    ),
  ];
}

function getScalarSelectFields(
  modelName: ModelName,
  args: QueryArgs,
) {
  const model = getModel(modelName);
  const fields = new Set<string>();
  const hasScalarSelect = isPlainObject(args.select) && !args.include;

  if (hasScalarSelect) {
    for (const [fieldName, enabled] of Object.entries(args.select as QueryArgs)) {
      if (enabled === true && model.fields[fieldName]?.kind !== "object") {
        fields.add(fieldName);
      }
    }
  } else {
    model.scalarFields.forEach((fieldName) => fields.add(fieldName));
  }

  for (const fieldName of toStringArray(args[INTERNAL_REQUIRED_FIELDS])) {
    if (model.fields[fieldName]?.kind !== "object") {
      fields.add(fieldName);
    }
  }

  for (const fieldName of toStringArray(args.distinct)) {
    if (model.fields[fieldName]?.kind !== "object") {
      fields.add(fieldName);
    }
  }

  for (const [relationName] of getRelationEntries(model, args)) {
    const relation = model.relations[relationName];
    relation.sourceFields.forEach((fieldName) => fields.add(fieldName));
  }

  if (fields.size === 0) {
    const fallbackField = model.primaryKey[0] ?? model.scalarFields[0];
    if (fallbackField) {
      fields.add(fallbackField);
    }
  }

  return Array.from(fields);
}

function buildSelectColumnsSql(
  modelName: ModelName,
  alias: string,
  args: QueryArgs,
) {
  return getScalarSelectFields(modelName, args)
    .map((fieldName) => `${quoteColumn(alias, fieldName)} AS ${quoteIdentifier(fieldName)}`)
    .join(", ");
}

function getIdentityFields(model: RuntimeModel) {
  return model.primaryKey.length > 0
    ? [...model.primaryKey]
    : [...(model.uniqueFields[0] ?? ["id"])];
}

function getNestedRelationSourceFields(
  model: RuntimeModel,
  relationData?: Record<string, unknown>,
) {
  if (!relationData) {
    return [];
  }

  const fields = new Set<string>();
  for (const relation of Object.values(model.relations)) {
    const relationValue = relationData[relation.fieldName];
    if (!isPlainObject(relationValue) || relation.owning) {
      continue;
    }
    if ("create" in relationValue || "createMany" in relationValue) {
      relation.sourceFields.forEach((fieldName) => fields.add(fieldName));
    }
  }
  return Array.from(fields);
}

function getWriteReturningFields(
  modelName: ModelName,
  args: QueryArgs,
  relationData?: Record<string, unknown>,
) {
  const model = getModel(modelName);
  const fields = new Set<string>();

  if (args.include) {
    getIdentityFields(model).forEach((fieldName) => fields.add(fieldName));
  } else if (isPlainObject(args.select)) {
    getScalarSelectFields(modelName, args).forEach((fieldName) => fields.add(fieldName));
    getIdentityFields(model).forEach((fieldName) => fields.add(fieldName));
  } else {
    model.scalarFields.forEach((fieldName) => fields.add(fieldName));
  }

  getNestedRelationSourceFields(model, relationData).forEach((fieldName) =>
    fields.add(fieldName),
  );

  const validFields = Array.from(fields).filter(
    (fieldName) => model.fields[fieldName]?.kind !== "object",
  );
  if (validFields.length > 0) {
    return validFields;
  }

  const fallbackField = getIdentityFields(model)[0] ?? model.scalarFields[0];
  return fallbackField ? [fallbackField] : [];
}

function buildReturningColumnsSql(modelName: ModelName, fields: string[]) {
  const model = getModel(modelName);
  const columns = fields.filter((fieldName) => model.fields[fieldName]?.kind !== "object");
  const returningFields = columns.length > 0
    ? columns
    : [getIdentityFields(model)[0] ?? model.scalarFields[0]].filter(Boolean);
  return returningFields.map((fieldName) => quoteIdentifier(fieldName)).join(", ");
}

function hydrateRow(modelName: ModelName, row: Record<string, unknown>) {
  const model = getModel(modelName);
  const hydrated: Record<string, unknown> = {};

  for (const fieldName of model.scalarFields) {
    const field = model.fields[fieldName];
    const value = row[fieldName];
    if (field.type === "Json" && typeof value === "string") {
      try {
        hydrated[fieldName] = JSON.parse(value);
        continue;
      } catch {
        hydrated[fieldName] = value;
        continue;
      }
    }
    hydrated[fieldName] = value;
  }

  return hydrated;
}

async function findManyInternal(
  modelName: ModelName,
  args: QueryArgs = {},
  sqlClient: DatabaseSqlClient = dbSql,
) {
  const model = getModel(modelName);
  const context: QueryContext = {
    aliasCounter: 0,
    values: [],
  };
  const alias = "t0";
  const whereSql = buildWhereSql(modelName, alias, args.where, context);
  const { orderBySql, selectPrefix } = buildDistinctSelectSql(
    modelName,
    alias,
    args,
    context,
  );
  const paginationSql = buildPaginationSql(
    toNumberOrUndefined(args.skip),
    toNumberOrUndefined(args.take),
    context,
  );
  const selectColumnsSql = buildSelectColumnsSql(modelName, alias, args);
  const query = `${selectPrefix} ${selectColumnsSql} FROM ${quoteQualifiedIdentifier("public", model.tableName)} ${quoteIdentifier(alias)} WHERE ${whereSql}${orderBySql}${paginationSql}`;
  const rows = await executeStatement(query, context.values, sqlClient);
  const hydrated = rows.map((row) => hydrateRow(modelName, row));
  return projectRows(modelName, hydrated, args, sqlClient);
}

async function findFirstInternal(
  modelName: ModelName,
  args: QueryArgs = {},
  sqlClient: DatabaseSqlClient = dbSql,
) {
  const items = await findManyInternal(
    modelName,
    {
      ...args,
      take: 1,
    },
    sqlClient,
  );
  return items[0] ?? null;
}

async function countInternal(
  modelName: ModelName,
  args: QueryArgs = {},
  sqlClient: DatabaseSqlClient = dbSql,
) {
  const model = getModel(modelName);
  const context: QueryContext = {
    aliasCounter: 0,
    values: [],
  };
  const alias = "t0";
  const whereSql = buildWhereSql(modelName, alias, args.where, context);
  const query = `SELECT COUNT(*)::int AS "count" FROM ${quoteQualifiedIdentifier("public", model.tableName)} ${quoteIdentifier(alias)} WHERE ${whereSql}`;
  const [row] = await executeStatement(query, context.values, sqlClient);
  return Number(row?.count ?? 0);
}

async function aggregateInternal(
  modelName: ModelName,
  args: QueryArgs = {},
  sqlClient: DatabaseSqlClient = dbSql,
) {
  const model = getModel(modelName);
  const context: QueryContext = {
    aliasCounter: 0,
    values: [],
  };
  const alias = "t0";
  const selectParts: string[] = [];
  const sumSelection = toQueryArgs(args._sum);
  const maxSelection = toQueryArgs(args._max);
  const countSelection =
    args._count === true ? { _all: true } : toQueryArgs(args._count);

  if (Object.keys(sumSelection).length > 0) {
    for (const [fieldName, enabled] of Object.entries(sumSelection)) {
      if (!enabled) {
        continue;
      }
      selectParts.push(`SUM(${quoteColumn(alias, fieldName)}) AS ${quoteIdentifier(`_sum_${fieldName}`)}`);
    }
  }

  if (Object.keys(maxSelection).length > 0) {
    for (const [fieldName, enabled] of Object.entries(maxSelection)) {
      if (!enabled) {
        continue;
      }
      selectParts.push(`MAX(${quoteColumn(alias, fieldName)}) AS ${quoteIdentifier(`_max_${fieldName}`)}`);
    }
  }

  if (args._count) {
    if (countSelection._all) {
      selectParts.push(`COUNT(*)::int AS "_count__all"`);
    }
    for (const [fieldName, enabled] of Object.entries(countSelection)) {
      if (fieldName === "_all" || !enabled) {
        continue;
      }
      selectParts.push(`COUNT(${quoteColumn(alias, fieldName)})::int AS ${quoteIdentifier(`_count_${fieldName}`)}`);
    }
  }

  const whereSql = buildWhereSql(modelName, alias, args.where, context);
  const query = `SELECT ${selectParts.join(", ")} FROM ${quoteQualifiedIdentifier("public", model.tableName)} ${quoteIdentifier(alias)} WHERE ${whereSql}`;
  const [row] = await executeStatement(query, context.values, sqlClient);

  return {
    _count: args._count
      ? Object.fromEntries(
          Object.entries(countSelection).map(([fieldName, enabled]) => [
            fieldName,
            enabled ? Number(row?.[`_count_${fieldName}`] ?? 0) : null,
          ]),
        )
      : undefined,
    _max: Object.keys(maxSelection).length > 0
      ? Object.fromEntries(
          Object.entries(maxSelection).map(([fieldName, enabled]) => [
            fieldName,
            enabled ? row?.[`_max_${fieldName}`] ?? null : null,
          ]),
        )
      : undefined,
    _sum: Object.keys(sumSelection).length > 0
      ? Object.fromEntries(
          Object.entries(sumSelection).map(([fieldName, enabled]) => [
            fieldName,
            enabled ? row?.[`_sum_${fieldName}`] ?? null : null,
          ]),
        )
      : undefined,
  };
}

async function groupByInternal(
  modelName: ModelName,
  args: QueryArgs = {},
  sqlClient: DatabaseSqlClient = dbSql,
) {
  const model = getModel(modelName);
  const by = Array.isArray(args.by)
    ? args.by.filter((fieldName): fieldName is string => typeof fieldName === "string")
    : [];
  const context: QueryContext = {
    aliasCounter: 0,
    values: [],
  };
  const alias = "t0";
  const selectParts = by.map((fieldName) => `${quoteColumn(alias, fieldName)} AS ${quoteIdentifier(fieldName)}`);
  const countSelection =
    args._count === true ? { _all: true } : toQueryArgs(args._count);
  const sumSelection = toQueryArgs(args._sum);
  const maxSelection = toQueryArgs(args._max);

  if (args._count) {
    if (countSelection._all) {
      selectParts.push(`COUNT(*)::int AS "_count__all"`);
    }
    for (const [fieldName, enabled] of Object.entries(countSelection)) {
      if (fieldName === "_all" || !enabled) {
        continue;
      }
      selectParts.push(`COUNT(${quoteColumn(alias, fieldName)})::int AS ${quoteIdentifier(`_count_${fieldName}`)}`);
    }
  }

  if (Object.keys(sumSelection).length > 0) {
    for (const [fieldName, enabled] of Object.entries(sumSelection)) {
      if (!enabled) {
        continue;
      }
      selectParts.push(`SUM(${quoteColumn(alias, fieldName)}) AS ${quoteIdentifier(`_sum_${fieldName}`)}`);
    }
  }

  if (Object.keys(maxSelection).length > 0) {
    for (const [fieldName, enabled] of Object.entries(maxSelection)) {
      if (!enabled) {
        continue;
      }
      selectParts.push(`MAX(${quoteColumn(alias, fieldName)}) AS ${quoteIdentifier(`_max_${fieldName}`)}`);
    }
  }

  const whereSql = buildWhereSql(modelName, alias, args.where, context);
  const groupBySql = by.length > 0 ? ` GROUP BY ${by.map((fieldName) => quoteColumn(alias, fieldName)).join(", ")}` : "";
  const orderBySql = buildOrderBySql(modelName, alias, args.orderBy, context);
  const query = `SELECT ${selectParts.join(", ")} FROM ${quoteQualifiedIdentifier("public", model.tableName)} ${quoteIdentifier(alias)} WHERE ${whereSql}${groupBySql}${orderBySql}`;
  const rows = await executeStatement(query, context.values, sqlClient);

  return rows.map((row) => ({
    ...Object.fromEntries(by.map((fieldName) => [fieldName, row[fieldName]])),
    ...(args._count
      ? {
          _count: Object.fromEntries(
            Object.entries(countSelection).map(([fieldName, enabled]) => [
              fieldName,
              enabled ? Number(row[`_count_${fieldName}`] ?? 0) : null,
            ]),
          ),
        }
      : {}),
    ...(Object.keys(sumSelection).length > 0
      ? {
          _sum: Object.fromEntries(
            Object.entries(sumSelection).map(([fieldName, enabled]) => [
              fieldName,
              enabled ? row[`_sum_${fieldName}`] ?? null : null,
            ]),
          ),
        }
      : {}),
    ...(Object.keys(maxSelection).length > 0
      ? {
          _max: Object.fromEntries(
            Object.entries(maxSelection).map(([fieldName, enabled]) => [
              fieldName,
              enabled ? row[`_max_${fieldName}`] ?? null : null,
            ]),
          ),
        }
      : {}),
  }));
}

async function resolveConnectTarget(
  modelName: ModelName,
  where: Record<string, unknown>,
  sqlClient: DatabaseSqlClient,
) {
  const row = await findFirstInternal(modelName, { where }, sqlClient);
  if (!row) {
    throw new DatabaseKnownRequestError(
      `${modelName} record not found for connect.`,
      "P2025",
    );
  }
  return row;
}

function normalizeNestedCreatePayload(value: unknown) {
  if (value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(isPlainObject);
  }

  if (isPlainObject(value) && Array.isArray(value.data)) {
    return value.data.filter(isPlainObject);
  }

  return isPlainObject(value) ? [value] : [];
}

function buildUpdateAssignment(
  model: RuntimeModel,
  fieldName: string,
  value: unknown,
  context: QueryContext,
  sourceQualifier?: string,
) {
  const field = model.fields[fieldName];
  const column = quoteIdentifier(fieldName);
  const currentColumn = sourceQualifier
    ? `${sourceQualifier}.${quoteIdentifier(fieldName)}`
    : column;

  if (!isFieldUpdateOperation(value)) {
    return `${column} = ${pushParameter(context, field, value)}`;
  }

  if ("set" in value) {
    return `${column} = ${pushParameter(context, field, value.set)}`;
  }

  const operations: Array<[string, string]> = [
    ["increment", "+"],
    ["decrement", "-"],
    ["multiply", "*"],
    ["divide", "/"],
  ];
  for (const [operation, operator] of operations) {
    if (operation in value) {
      return `${column} = ${currentColumn} ${operator} ${pushParameter(context, field, value[operation])}`;
    }
  }

  return `${column} = ${pushParameter(context, field, value)}`;
}

function hasNestedRelationWork(relationData: Record<string, unknown>) {
  return Object.values(relationData).some((value) => {
    if (!isPlainObject(value)) {
      return false;
    }
    return ["create", "createMany", "deleteMany", "connect", "disconnect"].some(
      (operation) => operation in value,
    );
  });
}

function toSqlFragment(input: unknown, values: unknown[]): SqlLikeFragment {
  if (Array.isArray(input)) {
    return {
      strings: input.map(String),
      values,
    };
  }

  if (
    input &&
    typeof input === "object" &&
    Array.isArray((input as SqlLikeFragment).strings) &&
    Array.isArray((input as SqlLikeFragment).values)
  ) {
    return input as SqlLikeFragment;
  }

  throw new Error("Expected a SQL tagged template or SQL fragment.");
}

function resolveUniqueWhere(
  modelName: ModelName,
  where: unknown,
): { fields: string[]; values: Record<string, unknown> } | null {
  if (!isPlainObject(where)) {
    return null;
  }

  const model = getModel(modelName);
  const entries = Object.entries(where);
  if (entries.length === 1) {
    const [key, value] = entries[0];
    const field = model.fields[key];
    if (field && (field.isId || field.isUnique)) {
      return {
        fields: [key],
        values: { [key]: value },
      };
    }

    const compoundFields = getCompoundFields(model, key);
    if (compoundFields && isPlainObject(value)) {
      return {
        fields: [...compoundFields],
        values: Object.fromEntries(
          compoundFields.map((fieldName) => [fieldName, value[fieldName]]),
        ),
      };
    }
  }

  const candidateKeys = [
    model.primaryKey,
    ...model.uniqueFields,
    ...Object.values(model.fields)
      .filter((field) => field.isId || field.isUnique)
      .map((field) => [field.name] as const),
  ].filter((fields) => fields.length > 0);

  const candidate = candidateKeys.find((fields) =>
    fields.every((fieldName) => Object.prototype.hasOwnProperty.call(where, fieldName)),
  );
  if (!candidate) {
    return null;
  }

  return {
    fields: [...candidate],
    values: Object.fromEntries(candidate.map((fieldName) => [fieldName, where[fieldName]])),
  };
}

async function normalizeUpdateData(
  modelName: ModelName,
  data: Record<string, unknown>,
  sqlClient: DatabaseSqlClient,
) {
  const model = getModel(modelName);
  const scalarData: Record<string, unknown> = {};
  const relationData: Record<string, unknown> = {};

  for (const [fieldName, value] of Object.entries(data)) {
    const field = model.fields[fieldName];
    if (!field) {
      continue;
    }
    if (field.kind === "object") {
      relationData[fieldName] = value;
    } else {
      scalarData[fieldName] = value;
    }
  }

  for (const relation of Object.values(model.relations)) {
    const relationValue = relationData[relation.fieldName];
    if (!isPlainObject(relationValue) || !relation.owning) {
      continue;
    }

    if ("connect" in relationValue) {
      const connected = await resolveConnectTarget(
        relation.targetModel,
        relationValue.connect as Record<string, unknown>,
        sqlClient,
      );
      relation.sourceFields.forEach((sourceField, index) => {
        scalarData[sourceField] = connected[relation.targetFields[index]];
      });
    } else if (relationValue.disconnect === true) {
      relation.sourceFields.forEach((sourceField) => {
        scalarData[sourceField] = null;
      });
    }
  }

  for (const fieldName of model.updatedAtFields) {
    scalarData[fieldName] = new Date();
  }

  return { relationData, scalarData };
}

async function normalizeCreateData(
  modelName: ModelName,
  data: Record<string, unknown>,
  sqlClient: DatabaseSqlClient,
) {
  const model = getModel(modelName);
  const scalarData: Record<string, unknown> = {};
  const relationData: Record<string, unknown> = {};

  for (const [fieldName, value] of Object.entries(data)) {
    const field = model.fields[fieldName];
    if (!field) {
      continue;
    }

    if (field.kind === "object") {
      relationData[fieldName] = value;
      continue;
    }

    if (value !== undefined) {
      scalarData[fieldName] = value;
    }
  }

  for (const relation of Object.values(model.relations)) {
    const relationValue = relationData[relation.fieldName];
    if (!isPlainObject(relationValue) || !relation.owning) {
      continue;
    }

    if ("connect" in relationValue) {
      const connected = await resolveConnectTarget(
        relation.targetModel,
        relationValue.connect as Record<string, unknown>,
        sqlClient,
      );
      relation.sourceFields.forEach((sourceField, index) => {
        scalarData[sourceField] = connected[relation.targetFields[index]];
      });
    } else if (relationValue.disconnect === true) {
      relation.sourceFields.forEach((sourceField) => {
        scalarData[sourceField] = null;
      });
    }
  }

  for (const fieldName of model.scalarFields) {
    const field = model.fields[fieldName];
    if (scalarData[fieldName] !== undefined) {
      continue;
    }
    const defaultValue = parseDefaultValue(field);
    if (defaultValue !== undefined) {
      scalarData[fieldName] = defaultValue;
    } else if (field.isUpdatedAt) {
      scalarData[fieldName] = new Date();
    }
  }

  for (const fieldName of model.updatedAtFields) {
    if (scalarData[fieldName] === undefined) {
      scalarData[fieldName] = new Date();
    }
  }

  return { relationData, scalarData };
}

async function insertRow(
  modelName: ModelName,
  scalarData: Record<string, unknown>,
  sqlClient: DatabaseSqlClient,
  returningFields: string[],
) {
  const model = getModel(modelName);
  const context: QueryContext = {
    aliasCounter: 0,
    values: [],
  };
  const fields = Object.keys(scalarData);
  const columns = fields.map((fieldName) => quoteIdentifier(fieldName)).join(", ");
  const placeholders = fields
    .map((fieldName) => pushParameter(context, model.fields[fieldName], scalarData[fieldName]))
    .join(", ");
  const returningColumns = buildReturningColumnsSql(modelName, returningFields);
  const query = `INSERT INTO ${quoteQualifiedIdentifier("public", model.tableName)} (${columns}) VALUES (${placeholders}) RETURNING ${returningColumns}`;
  try {
    const [row] = await executeStatement(query, context.values, sqlClient);
    return hydrateRow(modelName, row);
  } catch (error) {
    throw mapDatabaseError(error);
  }
}

function getNestedCreateManySkipDuplicates(value: unknown) {
  return isPlainObject(value) && value.skipDuplicates === true;
}

function attachNestedRelationFields(
  relation: RuntimeRelation,
  parentRow: Record<string, unknown>,
  entry: QueryArgs,
) {
  const childData = { ...entry };
  relation.targetFields.forEach((targetField, index) => {
    childData[targetField] = parentRow[relation.sourceFields[index]];
  });
  return childData;
}

async function processNestedRelationCreates(
  relation: RuntimeRelation,
  parentRow: Record<string, unknown>,
  relationValue: Record<string, unknown>,
  sqlClient: DatabaseSqlClient,
) {
  const createPayload = normalizeNestedCreatePayload(relationValue.create);
  for (const entry of createPayload) {
    await createRecord(
      relation.targetModel,
      {
        data: attachNestedRelationFields(relation, parentRow, entry),
      },
      sqlClient,
    );
  }

  const createManyPayload = normalizeNestedCreatePayload(relationValue.createMany);
  if (createManyPayload.length > 0) {
    await createManyRecords(
      relation.targetModel,
      {
        data: createManyPayload.map((entry) =>
          attachNestedRelationFields(relation, parentRow, entry),
        ),
        skipDuplicates: getNestedCreateManySkipDuplicates(relationValue.createMany),
      },
      sqlClient,
    );
  }
}

async function processNestedCreates(
  modelName: ModelName,
  parentRow: Record<string, unknown>,
  relationData: Record<string, unknown>,
  sqlClient: DatabaseSqlClient,
) {
  const model = getModel(modelName);

  for (const relation of Object.values(model.relations)) {
    const relationValue = relationData[relation.fieldName];
    if (!isPlainObject(relationValue) || relation.owning) {
      continue;
    }

    await processNestedRelationCreates(relation, parentRow, relationValue, sqlClient);
  }
}

async function projectWriteResult(
  modelName: ModelName,
  row: Record<string, unknown>,
  args: QueryArgs,
  sqlClient: DatabaseSqlClient,
) {
  if (args.include) {
    return findFirstInternal(
      modelName,
      {
        where: getIdentityWhere(modelName, row),
        select: args.select,
        include: args.include,
      },
      sqlClient,
    );
  }

  if (args.select) {
    const [projected] = await projectRows(
      modelName,
      [row],
      { select: args.select },
      sqlClient,
    );
    return projected ?? null;
  }

  return row;
}

async function createRecord(
  modelName: ModelName,
  args: QueryArgs,
  sqlClient: DatabaseSqlClient = dbSql,
) {
  const { relationData, scalarData } = await normalizeCreateData(
    modelName,
    toQueryArgs(args.data),
    sqlClient,
  );
  const created = await insertRow(
    modelName,
    scalarData,
    sqlClient,
    getWriteReturningFields(modelName, args, relationData),
  );
  await processNestedCreates(modelName, created, relationData, sqlClient);
  return projectWriteResult(modelName, created, args, sqlClient);
}

function getIdentityWhere(modelName: ModelName, row: Record<string, unknown>) {
  const model = getModel(modelName);
  const keyFields = getIdentityFields(model);
  return Object.fromEntries(keyFields.map((fieldName) => [fieldName, row[fieldName]]));
}

async function updateRecord(
  modelName: ModelName,
  args: QueryArgs,
  sqlClient: DatabaseSqlClient = dbSql,
) {
  const existing = await findFirstInternal(modelName, { where: args.where }, sqlClient);
  if (!existing) {
    throw new DatabaseKnownRequestError(
      `${modelName} record to update does not exist.`,
      "P2025",
    );
  }

  const model = getModel(modelName);
  const data = { ...toQueryArgs(args.data) };
  const scalarData: Record<string, unknown> = {};
  const relationData: Record<string, unknown> = {};

  for (const [fieldName, value] of Object.entries(data)) {
    const field = model.fields[fieldName];
    if (!field) {
      continue;
    }
    if (field.kind === "object") {
      relationData[fieldName] = value;
    } else {
      scalarData[fieldName] = value;
    }
  }

  for (const relation of Object.values(model.relations)) {
    const relationValue = relationData[relation.fieldName];
    if (!isPlainObject(relationValue) || !("connect" in relationValue) || !relation.owning) {
      continue;
    }
    const connected = await resolveConnectTarget(
      relation.targetModel,
      relationValue.connect as Record<string, unknown>,
      sqlClient,
    );
    relation.sourceFields.forEach((sourceField, index) => {
      scalarData[sourceField] = connected[relation.targetFields[index]];
    });
  }

  for (const fieldName of model.updatedAtFields) {
    scalarData[fieldName] = new Date();
  }

  const fields = Object.keys(scalarData);
  let updatedRow: Record<string, unknown> | null = null;
  if (fields.length > 0) {
    const context: QueryContext = {
      aliasCounter: 0,
      values: [],
    };
    const assignments = fields
      .map((fieldName) =>
        buildUpdateAssignment(model, fieldName, scalarData[fieldName], context),
      )
      .join(", ");
    const alias = "t0";
    const whereSql = buildWhereSql(modelName, alias, args.where, context);
    const returningColumns = buildReturningColumnsSql(
      modelName,
      getWriteReturningFields(modelName, args),
    );
    const query = `UPDATE ${quoteQualifiedIdentifier("public", model.tableName)} AS ${quoteIdentifier(alias)} SET ${assignments} WHERE ${whereSql} RETURNING ${returningColumns}`;
    try {
      const [row] = await executeStatement(query, context.values, sqlClient);
      updatedRow = row ? hydrateRow(modelName, row) : null;
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  for (const relation of Object.values(model.relations)) {
    const relationValue = relationData[relation.fieldName];
    if (!isPlainObject(relationValue)) {
      continue;
    }

    if (relation.owning) {
      continue;
    }

    if ("connect" in relationValue && !relation.isList && isPlainObject(relationValue.connect)) {
      const connected = await resolveConnectTarget(
        relation.targetModel,
        relationValue.connect as Record<string, unknown>,
        sqlClient,
      );
      await updateRecord(
        relation.targetModel,
        {
          where: getIdentityWhere(relation.targetModel, connected),
          data: Object.fromEntries(
            relation.targetFields.map((targetField, index) => [
              targetField,
              existing[relation.sourceFields[index]],
            ]),
          ),
        },
        sqlClient,
      );
    }

    if (relationValue.disconnect === true && !relation.isList) {
      const relatedWhere = Object.fromEntries(
        relation.targetFields.map((targetField, index) => [
          targetField,
          existing[relation.sourceFields[index]],
        ]),
      );
      await updateManyRecords(
        relation.targetModel,
        {
          where: relatedWhere,
          data: Object.fromEntries(
            relation.targetFields.map((targetField) => [targetField, null]),
          ),
        },
        sqlClient,
      );
    }

    if ("deleteMany" in relationValue) {
      const nestedWhere = isPlainObject(relationValue.deleteMany)
        ? relationValue.deleteMany
        : {};
      const combinedWhere = {
        ...nestedWhere,
        ...Object.fromEntries(
          relation.targetFields.map((targetField, index) => [
            targetField,
            existing[relation.sourceFields[index]],
          ]),
        ),
      };
      await deleteManyRecords(relation.targetModel, { where: combinedWhere }, sqlClient);
    }

    await processNestedRelationCreates(relation, existing, relationValue, sqlClient);
  }

  return projectWriteResult(modelName, updatedRow ?? existing, args, sqlClient);
}

async function updateManyRecords(
  modelName: ModelName,
  args: QueryArgs,
  sqlClient: DatabaseSqlClient = dbSql,
) {
  const model = getModel(modelName);
  const data: Record<string, unknown> = { ...toQueryArgs(args.data) };
  for (const fieldName of model.updatedAtFields) {
    data[fieldName] = new Date();
  }
  const fields = Object.keys(data);
  if (fields.length === 0) {
    return { count: 0 };
  }
  const context: QueryContext = {
    aliasCounter: 0,
    values: [],
  };
  const assignments = fields
    .map((fieldName) => buildUpdateAssignment(model, fieldName, data[fieldName], context))
    .join(", ");
  const alias = "t0";
  const whereSql = buildWhereSql(modelName, alias, args.where, context);
  const query = `UPDATE ${quoteQualifiedIdentifier("public", model.tableName)} AS ${quoteIdentifier(alias)} SET ${assignments} WHERE ${whereSql} RETURNING 1`;
  const rows = await executeStatement(query, context.values, sqlClient);
  return { count: rows.length };
}

async function deleteRecord(
  modelName: ModelName,
  args: QueryArgs,
  sqlClient: DatabaseSqlClient = dbSql,
) {
  const existing = await findFirstInternal(modelName, { where: args.where }, sqlClient);
  if (!existing) {
    throw new DatabaseKnownRequestError(
      `${modelName} record to delete does not exist.`,
      "P2025",
    );
  }

  const model = getModel(modelName);
  const context: QueryContext = {
    aliasCounter: 0,
    values: [],
  };
  const alias = "t0";
  const whereSql = buildWhereSql(modelName, alias, args.where, context);
  const query = `DELETE FROM ${quoteQualifiedIdentifier("public", model.tableName)} ${quoteIdentifier(alias)} WHERE ${whereSql}`;
  await executeStatement(query, context.values, sqlClient);
  return existing;
}

async function deleteManyRecords(
  modelName: ModelName,
  args: QueryArgs,
  sqlClient: DatabaseSqlClient = dbSql,
) {
  const model = getModel(modelName);
  const context: QueryContext = {
    aliasCounter: 0,
    values: [],
  };
  const alias = "t0";
  const whereSql = buildWhereSql(modelName, alias, args.where, context);
  const query = `DELETE FROM ${quoteQualifiedIdentifier("public", model.tableName)} ${quoteIdentifier(alias)} WHERE ${whereSql} RETURNING 1`;
  const rows = await executeStatement(query, context.values, sqlClient);
  return { count: rows.length };
}

async function createManyRecords(
  modelName: ModelName,
  args: QueryArgs,
  sqlClient: DatabaseSqlClient = dbSql,
) {
  const rows = toQueryArgRows(args.data);
  if (rows.length === 0) {
    return { count: 0 };
  }

  const model = getModel(modelName);
  const normalizedRows = [];
  for (const row of rows) {
    const { scalarData } = await normalizeCreateData(modelName, row, sqlClient);
    normalizedRows.push(scalarData);
  }

  const fields = Array.from(
    new Set(normalizedRows.flatMap((entry) => Object.keys(entry))),
  );
  const context: QueryContext = {
    aliasCounter: 0,
    values: [],
  };
  const valuesSql = normalizedRows
    .map((entry) => {
      const placeholders = fields.map((fieldName) =>
        pushParameter(context, model.fields[fieldName], entry[fieldName] ?? null),
      );
      return `(${placeholders.join(", ")})`;
    })
    .join(", ");
  const conflictSql = args.skipDuplicates ? " ON CONFLICT DO NOTHING" : "";
  const query = `INSERT INTO ${quoteQualifiedIdentifier("public", model.tableName)} (${fields.map((fieldName) => quoteIdentifier(fieldName)).join(", ")}) VALUES ${valuesSql}${conflictSql} RETURNING 1`;
  try {
    const inserted = await executeStatement(query, context.values, sqlClient);
    return { count: inserted.length };
  } catch (error) {
    throw mapDatabaseError(error);
  }
}

async function upsertRecord(
  modelName: ModelName,
  args: QueryArgs,
  sqlClient: DatabaseSqlClient = dbSql,
) {
  const uniqueWhere = resolveUniqueWhere(modelName, args.where);
  const { relationData: createRelationData, scalarData: createData } =
    await normalizeCreateData(modelName, toQueryArgs(args.create), sqlClient);
  const { relationData: updateRelationData, scalarData: updateData } =
    await normalizeUpdateData(modelName, toQueryArgs(args.update), sqlClient);

  if (
    uniqueWhere &&
    !hasNestedRelationWork(createRelationData) &&
    !hasNestedRelationWork(updateRelationData)
  ) {
    const model = getModel(modelName);
    const insertData = {
      ...uniqueWhere.values,
      ...createData,
    };
    const insertFields = Object.keys(insertData);
    const updateFields = Object.keys(updateData);
    const context: QueryContext = {
      aliasCounter: 0,
      values: [],
    };
    const columns = insertFields.map((fieldName) => quoteIdentifier(fieldName)).join(", ");
    const placeholders = insertFields
      .map((fieldName) => pushParameter(context, model.fields[fieldName], insertData[fieldName]))
      .join(", ");
    const conflictFields = uniqueWhere.fields
      .map((fieldName) => quoteIdentifier(fieldName))
      .join(", ");
    const assignments =
      updateFields.length > 0
        ? updateFields
            .map((fieldName) =>
              buildUpdateAssignment(
                model,
                fieldName,
                updateData[fieldName],
                context,
                quoteIdentifier(model.tableName),
              ),
            )
            .join(", ")
        : `${quoteIdentifier(uniqueWhere.fields[0])} = ${quoteQualifiedIdentifier(model.tableName, uniqueWhere.fields[0])}`;
    const returningColumns = buildReturningColumnsSql(
      modelName,
      getWriteReturningFields(modelName, args),
    );
    const query = `INSERT INTO ${quoteQualifiedIdentifier("public", model.tableName)} (${columns}) VALUES (${placeholders}) ON CONFLICT (${conflictFields}) DO UPDATE SET ${assignments} RETURNING ${returningColumns}`;

    try {
      const [row] = await executeStatement(query, context.values, sqlClient);
      const hydrated = hydrateRow(modelName, row);
      return projectWriteResult(modelName, hydrated, args, sqlClient);
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  const existing = await findFirstInternal(modelName, { where: args.where }, sqlClient);
  if (existing) {
    return updateRecord(
      modelName,
      {
        where: args.where,
        data: args.update,
        select: args.select,
        include: args.include,
      },
      sqlClient,
    );
  }

  return createRecord(
    modelName,
    {
      data: args.create,
      select: args.select,
      include: args.include,
    },
    sqlClient,
  );
}

async function projectRows(
  modelName: ModelName,
  rows: Record<string, unknown>[],
  args: QueryArgs = {},
  sqlClient: DatabaseSqlClient = dbSql,
) {
  const select = args.select;
  const include = args.include;
  if (!select && !include) {
    return rows;
  }

  const model = getModel(modelName);
  const baseRows = rows.map((row) => {
    if (select && !include) {
      return Object.fromEntries(
        Object.entries(select)
          .filter(([fieldName, enabled]) => enabled === true && !model.relations[fieldName])
          .map(([fieldName]) => [fieldName, row[fieldName]]),
      );
    }
    return { ...row };
  });

  const relationEntries = getRelationEntries(model, args);
  const seenRelations = new Set<string>();

  for (const [relationName, relationArgs] of relationEntries) {
    if (seenRelations.has(relationName)) {
      continue;
    }
    seenRelations.add(relationName);
    const relation = model.relations[relationName];
    const relatedMap = await loadRelationValues(
      modelName,
      relation,
      rows,
      relationArgs === true ? {} : (relationArgs as QueryArgs),
      sqlClient,
    );
    for (let index = 0; index < rows.length; index += 1) {
      const key = serializeKey(
        relation.sourceFields.map((fieldName) => rows[index][fieldName]),
      );
      baseRows[index][relationName] = relatedMap.get(key) ?? (relation.isList ? [] : null);
    }
  }

  return baseRows;
}

async function loadRelationValues(
  modelName: ModelName,
  relation: RuntimeRelation,
  sourceRows: Record<string, unknown>[],
  args: QueryArgs,
  sqlClient: DatabaseSqlClient,
) {
  const filters = sourceRows.flatMap((row) => {
    const filter = Object.fromEntries(
      relation.targetFields.map((targetField, index) => [
        targetField,
        row[relation.sourceFields[index]],
      ]),
    );

    if (Object.values(filter).some((value) => value === null || value === undefined)) {
      return [];
    }

    return [
      {
        filter,
        sourceKey: serializeKey(
          relation.sourceFields.map((fieldName) => row[fieldName]),
        ),
      },
    ];
  });

  if (filters.length === 0) {
    return new Map<string, unknown>();
  }

  const buildRelatedWhere = (relationWhere: QueryArgs) =>
    hasQueryWhere(args.where)
      ? {
          AND: [
            relationWhere,
            args.where,
          ],
        }
      : relationWhere;

  if (
    relation.isList &&
    (typeof args.take === "number" || typeof args.skip === "number")
  ) {
    const grouped = new Map<string, unknown>();
    const loadedKeys = new Set<string>();

    for (const { filter, sourceKey } of filters) {
      if (loadedKeys.has(sourceKey)) {
        continue;
      }
      loadedKeys.add(sourceKey);
      grouped.set(
        sourceKey,
        await findManyInternal(
          relation.targetModel,
          {
            ...args,
            where: buildRelatedWhere(filter),
            [INTERNAL_REQUIRED_FIELDS]: relation.targetFields,
          },
          sqlClient,
        ),
      );
    }

    return grouped;
  }

  const relationWhere =
    filters.length === 1
      ? filters[0].filter
      : {
          OR: filters.map(({ filter }) => filter),
        };
  const relatedRows = await findManyInternal(
    relation.targetModel,
    {
      ...args,
      where: buildRelatedWhere(relationWhere),
      [INTERNAL_REQUIRED_FIELDS]: relation.targetFields,
    },
    sqlClient,
  );

  const grouped = new Map<string, unknown>();
  for (const row of relatedRows) {
    const key = serializeKey(
      relation.targetFields.map((fieldName) => (row as Record<string, unknown>)[fieldName]),
    );
    if (relation.isList) {
      const existing = (grouped.get(key) as unknown[]) ?? [];
      existing.push(row);
      grouped.set(key, existing);
    } else {
      grouped.set(key, row);
    }
  }

  return grouped;
}

function mapDatabaseError(error: unknown) {
  const candidate = error as {
    code?: string;
    constraint_name?: string;
    constraint?: string;
    message?: string;
    detail?: string;
  };

  if (candidate?.code === "23505") {
    return new DatabaseKnownRequestError(
      candidate.message ?? "Unique constraint violation.",
      "P2002",
      {
        target: candidate.constraint_name ?? candidate.constraint,
      },
    );
  }

  if (candidate?.code === "23503") {
    return new DatabaseKnownRequestError(
      candidate.message ?? "Foreign key constraint violation.",
      "P2003",
      {
        field_name: candidate.constraint_name ?? candidate.constraint,
      },
    );
  }

  if (error instanceof Error) {
    return new DatabaseUnknownRequestError(error.message);
  }

  return new DatabaseUnknownRequestError("Unknown database error.");
}

function createModelDelegate(
  modelName: ModelName,
  sqlClient: DatabaseSqlClient,
) {
  return {
    aggregate(args?: QueryArgs) {
      return aggregateInternal(modelName, args, sqlClient);
    },
    count(args?: QueryArgs) {
      return countInternal(modelName, args, sqlClient);
    },
    create(args: QueryArgs) {
      return createRecord(modelName, args, sqlClient);
    },
    createMany(args: QueryArgs) {
      return createManyRecords(modelName, args, sqlClient);
    },
    delete(args: QueryArgs) {
      return deleteRecord(modelName, args, sqlClient);
    },
    deleteMany(args?: QueryArgs) {
      return deleteManyRecords(modelName, args ?? {}, sqlClient);
    },
    findFirst(args?: QueryArgs) {
      return findFirstInternal(modelName, args, sqlClient);
    },
    async findUnique(args?: QueryArgs) {
      return findFirstInternal(modelName, args, sqlClient);
    },
    async findUniqueOrThrow(args?: QueryArgs) {
      const row = await findFirstInternal(modelName, args, sqlClient);
      if (!row) {
        throw new DatabaseKnownRequestError(
          `${modelName} record not found.`,
          "P2025",
        );
      }
      return row;
    },
    findMany(args?: QueryArgs) {
      return findManyInternal(modelName, args, sqlClient);
    },
    groupBy(args?: QueryArgs) {
      return groupByInternal(modelName, args, sqlClient);
    },
    update(args: QueryArgs) {
      return updateRecord(modelName, args, sqlClient);
    },
    updateMany(args: QueryArgs) {
      return updateManyRecords(modelName, args, sqlClient);
    },
    upsert(args: QueryArgs) {
      return upsertRecord(modelName, args, sqlClient);
    },
  };
}

export function createDatabaseClient(
  sqlClient: DatabaseSqlClient = dbSql,
): Record<string, unknown> {
  const client: Record<string, unknown> = {};

  for (const modelName of Object.keys(modelSchema) as ModelName[]) {
    const delegateName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    client[delegateName] = createModelDelegate(modelName, sqlClient);
  }

  client.$disconnect = async () => {
    await sqlClient.end({ timeout: 5 });
  };
  client.$executeRaw = async (fragmentOrStrings: unknown, ...values: unknown[]) => {
    await executeSqlFragment(toSqlFragment(fragmentOrStrings, values), sqlClient);
    return 0;
  };
  client.$executeRawUnsafe = async (statement: string, ...values: unknown[]) => {
    await executeStatement(statement, values, sqlClient);
    return 0;
  };
  client.$queryRaw = async <T>(fragmentOrStrings: unknown, ...values: unknown[]) => {
    return executeSqlFragment<T>(
      toSqlFragment(fragmentOrStrings, values),
      sqlClient,
    ) as Promise<T>;
  };
  client.$queryRawUnsafe = async <T>(statement: string, ...values: unknown[]) => {
    return executeStatement(statement, values, sqlClient) as Promise<T>;
  };
  client.$transaction = async (input: unknown) => {
    if (Array.isArray(input)) {
      return Promise.all(input);
    }
    if (typeof input === "function") {
      return sqlClient.begin(async (transactionSql: unknown) => {
        const txClient = createDatabaseClient(
          transactionSql as DatabaseSqlClient,
        );
        return input(txClient);
      });
    }
    throw new Error("Unsupported transaction payload.");
  };

  return client;
}

const runtimeModels = (() => {
  const models = {} as Record<ModelName, RuntimeModel>;

  for (const modelName of Object.keys(modelSchema) as ModelName[]) {
    const schema = modelSchema[modelName];
    const fields = schema.fields as unknown as Record<string, RuntimeField>;
    const relations: Record<string, RuntimeRelation> = {};

    for (const field of Object.values(fields)) {
      if (field.kind !== "object") {
        continue;
      }

      let sourceFields = field.relationFromFields;
      let targetFields = field.relationToFields;
      const owning = sourceFields.length > 0;

      if (!owning) {
        const oppositeModel = modelSchema[field.type as ModelName];
        const oppositeField = Object.values(oppositeModel.fields).find(
          (candidate) =>
            candidate.kind === "object" &&
            candidate.type === modelName &&
            candidate.relationName === field.relationName &&
            candidate.relationFromFields.length > 0,
        ) as RuntimeField | undefined;

        if (oppositeField) {
          sourceFields = oppositeField.relationToFields;
          targetFields = oppositeField.relationFromFields;
        }
      }

      relations[field.name] = {
        fieldName: field.name,
        isList: field.isList,
        name: field.relationName ?? `${modelName}.${field.name}`,
        owning,
        sourceFields,
        targetFields,
        targetModel: field.type as ModelName,
      };
    }

    models[modelName] = {
      fields,
      name: modelName,
      primaryKey: schema.primaryKey as unknown as readonly string[],
      relations,
      scalarFields: Object.values(fields)
        .filter((field) => field.kind !== "object")
        .map((field) => field.name),
      tableName: schema.tableName,
      uniqueFields: schema.uniqueFields as unknown as readonly (readonly string[])[],
      updatedAtFields: Object.values(fields)
        .filter((field) => field.isUpdatedAt)
        .map((field) => field.name),
    };
  }

  return models;
})();
