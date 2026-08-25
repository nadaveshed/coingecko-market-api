declare global {
  namespace Express {
    interface Request {
      id: string;
      validatedQuery: { currency: string; page: number; per_page: number; limit: number };
    }
  }
}

export {};
