/**
 * CQRS Queries for the Professionals module.
 * Queries represent read operations that return data without changing state.
 */

export type ListProfessionalsQuery = {
  city?: string;
  page?: number;
  limit?: number;
};
