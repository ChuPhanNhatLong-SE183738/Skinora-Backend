export interface SuccessResponse<T = any> {
  success: true;
  code?: number;
  data: T;
  message: string;
}

export interface ErrorResponse {
  success: false;
  message: string;
  errorCode?: number;
  errors?: any;
}

export function successResponse<T = any>(
  data: T,
  message = 'Success',
  code?: number,
): SuccessResponse<T> {
  return {
    success: true,
    code,
    data,
    message,
  };
}

export function errorResponse(
  message = 'There was an error',
  errorCode?: number,
  errors?: any,
): ErrorResponse {
  return {
    success: false,
    message,
    errorCode,
    errors,
  };
}