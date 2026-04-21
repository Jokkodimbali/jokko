export enum PaymentMethod {
  WAVE = 'WAVE',
  ORANGE_MONEY = 'ORANGE_MONEY',
  CARD = 'CARD',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum EscrowStatus {
  LOCKED = 'LOCKED', // Fonds bloques en attente de prestation
  RELEASED = 'RELEASED', // Fonds debloques vers le professionnel
  DISPUTED = 'DISPUTED', // Litige ouvert, fonds en attente
  REFUNDED = 'REFUNDED', // Remboursement client
}

export enum WithdrawalStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum TransactionType {
  PAYMENT = 'PAYMENT', // Paiement client pour reservation
  ESCROW_RELEASE = 'ESCROW_RELEASE', // Deblocage fonds vers pro
  WITHDRAWAL = 'WITHDRAWAL', // Retrait pro vers mobile money
  REFUND = 'REFUND', // Remboursement client
  COMMISSION = 'COMMISSION', // Commission Jokko
}
