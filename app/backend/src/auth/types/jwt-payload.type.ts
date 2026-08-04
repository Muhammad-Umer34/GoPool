export interface JwtPayload {
  sub: string;
  email?: string | null;
  phoneNumber?: string | null;
  role: string;
  iat?: number;
  exp?: number;
}
