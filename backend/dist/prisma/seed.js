"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const adapter_pg_1 = require("@prisma/adapter-pg");
const client_1 = require("@prisma/client");
const argon2 = __importStar(require("argon2"));
const pg_1 = require("pg");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
}
const adapter = new adapter_pg_1.PrismaPg(new pg_1.Pool({
    connectionString,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 5000,
    allowExitOnIdle: true,
}));
const prisma = new client_1.PrismaClient({ adapter });
const CATEGORIES = [
    { nom: 'Sante & Medecine', ordreTri: 1 },
    { nom: 'Plomberie & Sanitaire', ordreTri: 2 },
    { nom: 'Electricite', ordreTri: 3 },
    { nom: 'Mecanique Automobile', ordreTri: 4 },
    { nom: 'Informatique & Tech', ordreTri: 5 },
    { nom: 'Cuisine & Traiteur', ordreTri: 6 },
    { nom: 'Beaute & Bien-etre', ordreTri: 7 },
    { nom: 'BTP & Renovation', ordreTri: 8 },
    { nom: 'Menage & Services', ordreTri: 9 },
    { nom: 'Cours & Formation', ordreTri: 10 },
    { nom: 'Transport & Livraison', ordreTri: 11 },
    { nom: 'Photo & Evenement', ordreTri: 12 },
];
async function seedCategories() {
    for (const category of CATEGORIES) {
        await prisma.categorie.upsert({
            where: { nom: category.nom },
            update: {
                ordreTri: category.ordreTri,
                estActive: true,
            },
            create: {
                nom: category.nom,
                ordreTri: category.ordreTri,
                estActive: true,
            },
        });
    }
}
async function seedAdminFromEnv() {
    const adminPhone = process.env.SEED_ADMIN_PHONE?.trim();
    const adminName = process.env.SEED_ADMIN_NAME?.trim() ?? 'Admin Jokko';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD?.trim();
    if (!adminPhone || !adminPassword) {
        return;
    }
    const passwordHash = await argon2.hash(adminPassword, {
        type: argon2.argon2id,
        memoryCost: 19_456,
        timeCost: 3,
        parallelism: 1,
    });
    await prisma.utilisateur.upsert({
        where: { numeroTelephone: adminPhone },
        update: {
            nom: adminName,
            motDePasseHash: passwordHash,
            role: client_1.RoleUtilisateur.ADMIN,
            estActif: true,
        },
        create: {
            numeroTelephone: adminPhone,
            nom: adminName,
            motDePasseHash: passwordHash,
            role: client_1.RoleUtilisateur.ADMIN,
            estActif: true,
        },
    });
}
async function main() {
    await seedCategories();
    await seedAdminFromEnv();
}
main()
    .then(async () => {
    await prisma.$disconnect();
})
    .catch(async (error) => {
    console.error('Seed error:', error);
    await prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=seed.js.map