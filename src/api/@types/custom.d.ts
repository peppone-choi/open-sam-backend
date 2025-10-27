declare global {
  namespace Express {
    interface Request {
      user: {
        userId: string;
        role: RoleType;
        refreshToken?: string;
      };
    }
  }
}

export {};