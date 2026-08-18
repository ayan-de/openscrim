export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  picture?: string;
  provider: string;
  providerId: string;
}

export interface AuthResponse {
  status: number;
  code: string;
  message: string;
  data: {
    user: User;
    accessToken: string;
  };
}
