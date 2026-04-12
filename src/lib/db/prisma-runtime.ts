import * as generated from "@/lib/db/generated-schema";
import {
  DatabaseInitializationError,
  DatabaseKnownRequestError,
  DatabaseUnknownRequestError,
  DatabaseValidationError,
} from "@/lib/db/errors";
import {
  empty,
  fragment,
  join,
  raw,
} from "@/lib/db/sql-fragment";
import { createDatabaseSqlClient } from "@/lib/db/postgres";
import { createDatabaseClient } from "@/lib/db/client";

class Decimal {
  private value: string;

  constructor(value: string | number | bigint) {
    this.value = String(value);
  }

  toJSON() {
    return this.value;
  }

  toString() {
    return this.value;
  }
}

const dmmf = {
  datamodel: {
    models: Object.entries(generated.modelSchema).map(([name, model]) => ({
      name,
      fields: Object.values(model.fields).map((field) => ({
        name: field.name,
        kind: field.kind,
        type: field.type,
        isList: field.isList,
        isRequired: field.isRequired,
        isUnique: field.isUnique,
        isId: field.isId,
      })),
    })),
  },
} as const;

export class PrismaClient {
  constructor(options?: {
    datasources?: {
      db?: {
        url?: string;
      };
    };
  }) {
    const explicitUrl = options?.datasources?.db?.url?.trim();
    if (explicitUrl) {
      return createDatabaseClient(
        createDatabaseSqlClient(explicitUrl),
      ) as never;
    }

    return createDatabaseClient() as never;
  }
}

export const Prisma = {
  prismaVersion: {
    client: "supabase-sql",
    engine: "supabase-sql",
  },
  PrismaClientKnownRequestError: DatabaseKnownRequestError,
  PrismaClientUnknownRequestError: DatabaseUnknownRequestError,
  PrismaClientInitializationError: DatabaseInitializationError,
  PrismaClientValidationError: DatabaseValidationError,
  dmmf,
  Decimal,
  sql: fragment,
  empty,
  join,
  raw,
  validator:
    <T>() =>
    <S extends T>(value: S) =>
      value,
  getExtensionContext: <T>(value: T) => value,
  defineExtension: <T>(value: T) => value,
  DbNull: null,
  JsonNull: null,
  AnyNull: null,
  NullTypes: {
    DbNull: null,
    JsonNull: null,
    AnyNull: null,
  },
  TransactionIsolationLevel: {
    ReadCommitted: "ReadCommitted",
    ReadUncommitted: "ReadUncommitted",
    RepeatableRead: "RepeatableRead",
    Serializable: "Serializable",
  },
  QueryMode: {
    default: "default",
    insensitive: "insensitive",
  },
} as const;

export * from "@/lib/db/generated-schema";
