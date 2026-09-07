export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export function success<T>(message: string, data: T): ApiResponse<T> {
  return {
    code: 1,
    message,
    data,
  };
}
