type EnvValide = {
    NODE_ENV: 'development' | 'test' | 'production';
    PORT: number;
    DATABASE_URL: string;
    JWT_ACCESS_SECRET: string;
    JWT_REFRESH_SECRET: string;
    JWT_ACCESS_TTL: string;
    JWT_REFRESH_TTL: string;
    GOOGLE_CLIENT_ID: string;
};
export declare function validerEnv(env: Record<string, unknown>): EnvValide;
export {};
