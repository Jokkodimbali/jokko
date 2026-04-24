import 'dotenv/config';
import {
  PrismaClient,
  StatutPaiement,
  StatutReservation,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PAYMENT_COMMISSION_RATE_PERCENT } from '../src/payments/domain/payment.constants';
import { TECHNICAL_MESSAGES } from '../src/core/messages/technical-message.catalog';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(TECHNICAL_MESSAGES.SEED_DATABASE_URL_MISSING);
}

const adapter = new PrismaPg(
  new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 5000,
    allowExitOnIdle: true,
  }),
);

const prisma = new PrismaClient({ adapter });

const REPAIR_PREFIX = '[REPARATION_HISTORIQUE_2026-04-24]';
const APPLY_MODE = process.argv.includes('--apply');
const TARGET_BOOKING_STATUSES: StatutReservation[] = [
  StatutReservation.PAYEE_SEQUESTRE,
  StatutReservation.EN_COURS,
  StatutReservation.TERMINEE,
  StatutReservation.LITIGE,
  StatutReservation.NO_SHOW,
];

type RepairSummary = {
  applyMode: boolean;
  successfulPaymentsAudited: number;
  paymentsToRepair: number;
  paymentsRepaired: number;
  bookingsWithoutPaymentToRepair: number;
  bookingsRepaired: number;
};

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildRepairNote(
  previousStatus: StatutReservation,
  existingNotes: string | null,
  existingReason: string | null,
): string {
  const normalizedNotes = existingNotes?.trim() ?? '';
  const reasonFragment =
    existingReason && existingReason.trim().length > 0
      ? ` Motif historise: ${existingReason.trim()}.`
      : '';
  const repairFragment =
    `${REPAIR_PREFIX} Ancien statut: ${previousStatus}. ` +
    'Reservation repassee a CONFIRMEE car aucun paiement n etait associe.' +
    reasonFragment;

  if (normalizedNotes.includes(REPAIR_PREFIX)) {
    return normalizedNotes;
  }

  return normalizedNotes.length > 0
    ? `${normalizedNotes}\n${repairFragment}`
    : repairFragment;
}

async function runRepair(): Promise<RepairSummary> {
  const successfulPayments = await prisma.paiement.findMany({
    where: { statut: StatutPaiement.SUCCES },
    select: {
      id: true,
      montant: true,
      montantCommission: true,
      montantNet: true,
    },
  });

  const paymentsToRepair = successfulPayments.filter((payment) => {
    const amount = Number(payment.montant);
    const expectedCommission = roundCurrency(
      amount * (PAYMENT_COMMISSION_RATE_PERCENT / 100),
    );
    const expectedNet = roundCurrency(amount - expectedCommission);

    return (
      Number(payment.montantCommission) !== expectedCommission ||
      Number(payment.montantNet) !== expectedNet
    );
  });

  const bookingsWithoutPayment = await prisma.reservation.findMany({
    where: {
      statut: { in: TARGET_BOOKING_STATUSES },
      paiement: null,
    },
    select: {
      id: true,
      statut: true,
      notes: true,
      raisonAnnulation: true,
    },
  });

  if (APPLY_MODE) {
    await prisma.$transaction(
      async (tx) => {
        for (const payment of paymentsToRepair) {
          const amount = Number(payment.montant);
          const expectedCommission = roundCurrency(
            amount * (PAYMENT_COMMISSION_RATE_PERCENT / 100),
          );
          const expectedNet = roundCurrency(amount - expectedCommission);

          await tx.paiement.update({
            where: { id: payment.id },
            data: {
              montantCommission: expectedCommission,
              montantNet: expectedNet,
            },
          });
        }

        for (const booking of bookingsWithoutPayment) {
          await tx.reservation.update({
            where: { id: booking.id },
            data: {
              statut: StatutReservation.CONFIRMEE,
              notes: buildRepairNote(
                booking.statut,
                booking.notes,
                booking.raisonAnnulation,
              ),
              raisonAnnulation: null,
            },
          });
        }
      },
      {
        maxWait: 10000,
        timeout: 30000,
      },
    );
  }

  return {
    applyMode: APPLY_MODE,
    successfulPaymentsAudited: successfulPayments.length,
    paymentsToRepair: paymentsToRepair.length,
    paymentsRepaired: APPLY_MODE ? paymentsToRepair.length : 0,
    bookingsWithoutPaymentToRepair: bookingsWithoutPayment.length,
    bookingsRepaired: APPLY_MODE ? bookingsWithoutPayment.length : 0,
  };
}

runRepair()
  .then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
