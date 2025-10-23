import { PrismaClient, InvoiceStatus, QuoteStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { calculateDocumentTotals, calculateLineTotals } from "../src/lib/documents";
import { euroToCents } from "../src/lib/documents";

const prisma = new PrismaClient();

async function resetDatabase() {
  await prisma.emailLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.quoteLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.product.deleteMany();
  await prisma.client.deleteMany();
  await prisma.numberingSequence.deleteMany();
  await prisma.pdfTemplate.deleteMany();
  await prisma.companySettings.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

async function seed() {
  await resetDatabase();

  const passwordHash = await bcrypt.hash("Admin@2025", 12);

  const adminUser = await prisma.user.create({
    data: {
      email: "admin@demo.fr",
      passwordHash,
      name: "Administrateur",
    },
  });

  const invoiceTemplate = await prisma.pdfTemplate.create({
    data: {
      type: "FACTURE",
      name: "Modèle standard facture",
      content: {
        accentColor: "#2563eb",
        showWatermark: false,
        displayLogo: true,
      },
    },
  });

  const quoteTemplate = await prisma.pdfTemplate.create({
    data: {
      type: "DEVIS",
      name: "Modèle standard devis",
      content: {
        accentColor: "#10b981",
        showWatermark: false,
        displayLogo: true,
      },
    },
  });

  await prisma.companySettings.create({
    data: {
      id: 1,
      companyName: "Société Démonstration",
      logoUrl: null,
      siren: "123 456 789",
      tvaNumber: "FR12 3456 78901",
      address:
        "15 Avenue de la République\n75011 Paris\nFrance",
      email: "contact@demo.fr",
      phone: "+33 1 23 45 67 89",
      iban: "FR76 3000 6000 0112 3456 7890 189",
      defaultCurrency: "EUR",
      defaultVatRate: 20,
      paymentTerms: "Paiement à 30 jours fin de mois.",
      invoiceNumberPrefix: "FAC",
      quoteNumberPrefix: "DEV",
      resetNumberingAnnually: true,
      defaultInvoiceFooter:
        "Mentions légales : pénalités de retard exigibles, indemnité forfaitaire de recouvrement de 40 €.",
      defaultQuoteFooter:
        "Le devis est valable 30 jours. Réponse souhaitée sous 15 jours.",
      legalFooter:
        "Société Démonstration - SAS au capital de 50 000 € - RCS Paris 123 456 789.",
      defaultConditions:
        "Paiement par virement bancaire. Livraison sous 5 jours ouvrés après acceptation.",
      invoiceTemplateId: invoiceTemplate.id,
      quoteTemplateId: quoteTemplate.id,
    },
  });

  const clients = await prisma.$transaction(
    [
      {
        displayName: "Ateliers Martin",
        companyName: "Ateliers Martin SARL",
        address:
          "24 Rue des Lilas\n44100 Nantes\nFrance",
        email: "contact@ateliersmartin.fr",
        phone: "+33 2 40 00 11 22",
        vatNumber: "FR45 6789 01234",
        notes: "Client historique, conditions négociées.",
      },
      {
        displayName: "Agence Boréal",
        companyName: "Agence Boréal",
        address:
          "5 Rue de la Paix\n31000 Toulouse\nFrance",
        email: "facturation@boreal.fr",
        phone: "+33 5 34 12 98 76",
        vatNumber: "FR98 7654 32109",
        notes: "Préférence pour les devis détaillés.",
      },
      {
        displayName: "Clinique du Parc",
        companyName: "Clinique du Parc",
        address:
          "112 Boulevard des Hôpitaux\n69000 Lyon\nFrance",
        email: "compta@cliniqueduparc.fr",
        phone: "+33 4 72 00 45 45",
        vatNumber: "FR21 4567 89012",
        notes: "Facturation mensuelle regroupée.",
      },
      {
        displayName: "Maison Côté Mer",
        companyName: "Maison d'hôtes Côté Mer",
        address:
          "8 Promenade des Anglais\n06000 Nice\nFrance",
        email: "gestion@cotemer.fr",
        phone: "+33 4 93 12 34 56",
        vatNumber: "FR34 5678 90123",
        notes: "Client saisonnier.",
      },
      {
        displayName: "Start Innov",
        companyName: "Start Innov SAS",
        address:
          "18 Rue Oberkampf\n75011 Paris\nFrance",
        email: "finance@startinnov.fr",
        phone: "+33 1 53 67 89 10",
        vatNumber: "FR87 1234 56789",
        notes: "Paiement rapide, communication Slack.",
      },
    ].map((data) => prisma.client.create({ data })),
  );

  const productsData = [
    {
      sku: "SERV-CONSTR",
      name: "Prestation de conseil",
      description: "Accompagnement stratégique sur mesure.",
      category: "Services",
      unit: "jour",
      priceHT: 720,
      vat: 20,
      discount: 0,
    },
    {
      sku: "SERV-INTEG",
      name: "Intégration applicative",
      description: "Intégration technique et tests QA.",
      category: "Services",
      unit: "jour",
      priceHT: 580,
      vat: 20,
      discount: 5,
    },
    {
      sku: "LIC-PLATEFORME",
      name: "Licence plateforme SaaS",
      description: "Licence annuelle pour la plateforme SaaS.",
      category: "Licences",
      unit: "unité",
      priceHT: 3200,
      vat: 20,
      discount: 0,
    },
    {
      sku: "MAINT-STD",
      name: "Maintenance standard",
      description: "Maintenance corrective et évolutive.",
      category: "Maintenance",
      unit: "mois",
      priceHT: 450,
      vat: 20,
      discount: 0,
    },
    {
      sku: "FORM-TEAM",
      name: "Formation équipe",
      description: "Formation présentielle pour 6 personnes.",
      category: "Formation",
      unit: "session",
      priceHT: 980,
      vat: 20,
      discount: 10,
    },
    {
      sku: "AUDIT-SEC",
      name: "Audit de sécurité",
      description: "Audit complet des infrastructures.",
      category: "Audit",
      unit: "prestation",
      priceHT: 2800,
      vat: 20,
      discount: 0,
    },
    {
      sku: "SUPPORT-PREM",
      name: "Support premium",
      description: "Support prioritaire 24/7.",
      category: "Support",
      unit: "mois",
      priceHT: 390,
      vat: 20,
      discount: 0,
    },
    {
      sku: "SERV-DESIGN",
      name: "Atelier design UX",
      description: "Atelier UX/UI pour équipes produit.",
      category: "Design",
      unit: "jour",
      priceHT: 650,
      vat: 20,
      discount: 5,
    },
  ];

  const products = await prisma.$transaction(
    productsData.map((product) => {
      const priceHTCents = euroToCents(product.priceHT);
      const priceTTCCents = Math.round(
        priceHTCents * (1 + product.vat / 100),
      );
      return prisma.product.create({
        data: {
          sku: product.sku,
          name: product.name,
          description: product.description,
          category: product.category,
          unit: product.unit,
          priceHTCents,
          priceTTCCents,
          vatRate: product.vat,
          defaultDiscountRate:
            product.discount && product.discount > 0
              ? product.discount
              : null,
        },
      });
    }),
  );

  await prisma.numberingSequence.createMany({
    data: [
      {
        type: "DEVIS",
        prefix: "DEV",
        year: new Date().getFullYear(),
        counter: 4,
      },
      {
        type: "FACTURE",
        prefix: "FAC",
        year: new Date().getFullYear(),
        counter: 6,
      },
    ],
  });

  const quoteBaseDate = new Date();

  const quoteLines = [
    [
      {
        productIndex: 0,
        quantity: 3,
        discountRate: 0,
      },
      {
        productIndex: 4,
        quantity: 1,
        discountRate: 5,
      },
    ],
    [
      {
        productIndex: 1,
        quantity: 5,
        discountRate: 5,
      },
      {
        productIndex: 7,
        quantity: 2,
        discountRate: 0,
      },
    ],
  ];

  const createdQuotes: Awaited<
    ReturnType<typeof prisma.quote.create>
  >[] = [];

  for (let i = 0; i < quoteLines.length; i += 1) {
    const client = clients[i];
    const lines = quoteLines[i].map((line) => {
      const product = products[line.productIndex];
      return calculateLineTotals({
        quantity: line.quantity,
        unitPriceHTCents: product.priceHTCents,
        vatRate: product.vatRate,
        discountRate: line.discountRate,
      });
    });

    const totals = calculateDocumentTotals(lines, 5);
    const number = `DEV-${quoteBaseDate.getFullYear()}-${String(i + 1).padStart(4, "0")}`;

    const quote = await prisma.quote.create({
      data: {
        number,
        status: i === 0 ? QuoteStatus.ENVOYE : QuoteStatus.ACCEPTE,
        reference: `Q-${i + 1}`,
        issueDate: new Date(
          quoteBaseDate.getFullYear(),
          quoteBaseDate.getMonth(),
          quoteBaseDate.getDate() - (i + 3),
        ),
        validUntil: new Date(
          quoteBaseDate.getFullYear(),
          quoteBaseDate.getMonth(),
          quoteBaseDate.getDate() + 30,
        ),
        clientId: client.id,
        currency: "EUR",
        globalDiscountRate: 5,
        globalDiscountAmountCents: totals.globalDiscountAppliedCents,
        vatBreakdown: totals.vatEntries,
        notes: "Merci pour votre confiance.",
        terms: "Validité 30 jours. Signature électronique acceptée.",
        subtotalHTCents: totals.subtotalHTCents,
        totalDiscountCents: totals.totalDiscountCents,
        totalTVACents: totals.totalTVACents,
        totalTTCCents: totals.totalTTCCents,
        lines: {
          create: lines.map((line, index) => ({
            productId: products[quoteLines[i][index].productIndex].id,
            description: products[quoteLines[i][index].productIndex].name,
            quantity: line.quantity,
            unit: products[quoteLines[i][index].productIndex].unit,
            unitPriceHTCents: line.unitPriceHTCents,
            vatRate: line.vatRate,
            discountRate: line.discountRate,
            discountAmountCents: line.discountAmountCents,
            totalHTCents: line.totalHTCents,
            totalTVACents: line.totalTVACents,
            totalTTCCents: line.totalTTCCents,
            position: index,
          })),
        },
      },
      include: {
        lines: true,
      },
    });

    createdQuotes.push(quote);
  }

  const invoiceLinesSeed = [
    [
      {
        productIndex: 0,
        quantity: 5,
        discountRate: 0,
      },
      {
        productIndex: 3,
        quantity: 3,
        discountRate: 0,
      },
    ],
    [
      {
        productIndex: 5,
        quantity: 1,
        discountRate: 0,
      },
      {
        productIndex: 6,
        quantity: 6,
        discountRate: 0,
      },
    ],
  ];

  const createdInvoices: Awaited<
    ReturnType<typeof prisma.invoice.create>
  >[] = [];

  for (let i = 0; i < invoiceLinesSeed.length; i += 1) {
    const client = clients[(i + 2) % clients.length];
    const lines = invoiceLinesSeed[i].map((line) => {
      const product = products[line.productIndex];
      return calculateLineTotals({
        quantity: line.quantity,
        unitPriceHTCents: product.priceHTCents,
        vatRate: product.vatRate,
        discountRate: line.discountRate,
      });
    });

    const totals = calculateDocumentTotals(
      lines,
      i === 0 ? 0 : 3,
    );
    const number = `FAC-${quoteBaseDate.getFullYear()}-${String(i + 1).padStart(4, "0")}`;

    const invoiceStatus =
      i === 0 ? InvoiceStatus.PAYEE : InvoiceStatus.ENVOYEE;

    const invoice = await prisma.invoice.create({
      data: {
        number,
        status: invoiceStatus,
        reference: `F-${i + 1}`,
        issueDate: new Date(
          quoteBaseDate.getFullYear(),
          quoteBaseDate.getMonth(),
          quoteBaseDate.getDate() - (i + 10),
        ),
        dueDate: new Date(
          quoteBaseDate.getFullYear(),
          quoteBaseDate.getMonth(),
          quoteBaseDate.getDate() + (i === 0 ? 10 : -5),
        ),
        clientId: client.id,
        currency: "EUR",
        globalDiscountRate: i === 0 ? null : 3,
        globalDiscountAmountCents:
          totals.globalDiscountAppliedCents > 0
            ? totals.globalDiscountAppliedCents
            : null,
        vatBreakdown: totals.vatEntries,
        notes: "Merci pour votre règlement.",
        terms: "Paiement par virement. IBAN fourni.",
        lateFeeRate: 5,
        subtotalHTCents: totals.subtotalHTCents,
        totalDiscountCents: totals.totalDiscountCents,
        totalTVACents: totals.totalTVACents,
        totalTTCCents: totals.totalTTCCents,
        amountPaidCents:
          invoiceStatus === InvoiceStatus.PAYEE
            ? totals.totalTTCCents
            : Math.round(totals.totalTTCCents * 0.4),
        lines: {
          create: lines.map((line, index) => ({
            productId: products[invoiceLinesSeed[i][index].productIndex].id,
            description:
              products[invoiceLinesSeed[i][index].productIndex].name,
            quantity: line.quantity,
            unit: products[invoiceLinesSeed[i][index].productIndex].unit,
            unitPriceHTCents: line.unitPriceHTCents,
            vatRate: line.vatRate,
            discountRate: line.discountRate,
            discountAmountCents: line.discountAmountCents,
            totalHTCents: line.totalHTCents,
            totalTVACents: line.totalTVACents,
            totalTTCCents: line.totalTTCCents,
            position: index,
          })),
        },
      },
    });

    createdInvoices.push(invoice);

    if (invoiceStatus === InvoiceStatus.PAYEE) {
      await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amountCents: totals.totalTTCCents,
          method: "Virement bancaire",
          date: new Date(
            quoteBaseDate.getFullYear(),
            quoteBaseDate.getMonth(),
            quoteBaseDate.getDate() - 2,
          ),
          note: "Paiement reçu en totalité.",
        },
      });
    } else {
      await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amountCents: Math.round(totals.totalTTCCents * 0.4),
          method: "Virement bancaire",
          date: new Date(
            quoteBaseDate.getFullYear(),
            quoteBaseDate.getMonth(),
            quoteBaseDate.getDate() - 1,
          ),
          note: "Acompte de 40 % reçu.",
        },
      });
    }
  }

  if (createdQuotes[1]) {
    await prisma.invoice.update({
      where: {
        number: `FAC-${quoteBaseDate.getFullYear()}-0002`,
      },
      data: {
        quoteId: createdQuotes[1].id,
      },
    });
  }

  await prisma.emailLog.createMany({
    data: [
      {
        documentType: "DEVIS",
        documentId: createdQuotes[0].id,
        to: "contact@ateliersmartin.fr",
        subject: "Envoi devis DEV-0001",
        body: "Bonjour, veuillez trouver votre devis en pièce jointe.",
        sentAt: new Date(),
        status: "ENVOYE",
      },
      createdInvoices[1] && {
        documentType: "FACTURE",
        documentId: createdInvoices[1].id,
        to: "finance@startinnov.fr",
        subject: "Relance facture FAC-0002",
        body: "Bonjour, il reste un solde à régler sur la facture FAC-0002.",
        status: "EN_ATTENTE",
      },
    ].filter(Boolean) as Parameters<typeof prisma.emailLog.createMany>[0]["data"],
  });

  console.info("✔ Seed terminé : données de démonstration importées.");
  console.info(`Compte administrateur: ${adminUser.email} / Admin@2025`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
