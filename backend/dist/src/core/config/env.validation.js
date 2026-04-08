"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validerEnv = validerEnv;
const message_catalog_1 = require("../http/message-catalog");
function asString(value, fallback = '') {
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return fallback;
}
function asNombre(value, fallback) {
    if (!value) {
        return fallback;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed <= 0) {
        throw new Error(message_catalog_1.ENV_MESSAGES.INVALID_PORT(value));
    }
    return parsed;
}
function requiredSecret(name, value) {
    const secret = asString(value).trim();
    if (secret.length < 16) {
        throw new Error(message_catalog_1.ENV_MESSAGES.INVALID_SECRET_MIN_LENGTH(name));
    }
    return secret;
}
function validerEnv(env) {
    const nodeEnv = asString(env.NODE_ENV, 'development');
    if (!['development', 'test', 'production'].includes(nodeEnv)) {
        throw new Error(message_catalog_1.ENV_MESSAGES.INVALID_NODE_ENV(env.NODE_ENV));
    }
    const databaseUrl = asString(env.DATABASE_URL).trim();
    if (!databaseUrl.startsWith('postgresql://')) {
        throw new Error(message_catalog_1.ENV_MESSAGES.INVALID_DATABASE_URL);
    }
    return {
        NODE_ENV: nodeEnv,
        PORT: asNombre(typeof env.PORT === 'string' ? env.PORT : undefined, 3000),
        DATABASE_URL: databaseUrl,
        JWT_ACCESS_SECRET: requiredSecret('JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET),
        JWT_REFRESH_SECRET: requiredSecret('JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET),
        JWT_ACCESS_TTL: asString(env.JWT_ACCESS_TTL, '15m'),
        JWT_REFRESH_TTL: asString(env.JWT_REFRESH_TTL, '30d'),
        GOOGLE_CLIENT_ID: asString(env.GOOGLE_CLIENT_ID).trim(),
    };
}
//# sourceMappingURL=env.validation.js.map