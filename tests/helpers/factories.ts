import { DEFAULT_ROLE_PERMISSIONS, OWNER_ROLE_NAME } from "@/server/permissions";

import { testDb } from "./db";

let seq = 0;
export const uid = (prefix = "x") => `${prefix}${++seq}${Math.random().toString(36).slice(2, 6)}`;

export async function createRole(
  name: keyof typeof DEFAULT_ROLE_PERMISSIONS | string,
  permissions?: readonly string[],
) {
  const perms = permissions ?? DEFAULT_ROLE_PERMISSIONS[name] ?? [];
  return testDb.role.create({
    data: {
      name,
      isSystem: name === OWNER_ROLE_NAME,
      permissions: { create: perms.map((permission) => ({ permission })) },
    },
  });
}

export async function createUser(
  opts: {
    roleId?: string | null;
    status?: "ACTIVE" | "INVITED" | "DEACTIVATED";
    email?: string;
    name?: string;
  } = {},
) {
  return testDb.user.create({
    data: {
      name: opts.name ?? "Test user",
      email: opts.email ?? `${uid("user")}@example.test`,
      emailVerified: true,
      roleId: opts.roleId ?? null,
      status: opts.status ?? "ACTIVE",
    },
  });
}

export async function createProduct(
  opts: {
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    variants?: {
      sku?: string;
      price?: number;
      stock?: number;
      optionValues?: Record<string, string>;
    }[];
    name?: string;
    categoryId?: string;
  } = {},
) {
  const name = opts.name ?? `Product ${uid()}`;
  return testDb.product.create({
    data: {
      name,
      slug: uid("p-"),
      status: opts.status ?? "PUBLISHED",
      categoryId: opts.categoryId,
      variants: {
        create: (opts.variants ?? [{}]).map((v) => ({
          sku: v.sku ?? uid("SKU").toUpperCase(),
          price: v.price ?? 1000,
          stock: v.stock ?? 10,
          optionValues: v.optionValues ?? {},
        })),
      },
    },
    include: { variants: true },
  });
}

export async function createMedia() {
  return testDb.media.create({
    data: {
      key: `media/2026/01/${crypto.randomUUID()}.jpg`,
      url: "https://media.test/x.jpg",
      bytes: 100,
      mimeType: "image/jpeg",
    },
  });
}
