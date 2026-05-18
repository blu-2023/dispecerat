import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      organizationId: string;
      organizationName: string;
      organizationSlug: string;
      organizationPlan: string;
    };
  }

  interface User {
    role: string;
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    organizationPlan: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    organizationPlan: string;
  }
}
