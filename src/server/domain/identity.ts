export type VerifiedIdentity = Readonly<{ subject: string; uid: string; email: string; name: string | null; authenticatedAt?: Date }>;
