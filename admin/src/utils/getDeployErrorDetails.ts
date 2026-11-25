export const getDeployErrorDetails = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object" || !("response" in error)) {
    return undefined;
  }

  const response = error.response;
  if (!response || typeof response !== "object" || !("data" in response)) {
    return undefined;
  }

  const data = response.data;
  if (!data || typeof data !== "object" || !("error" in data)) {
    return undefined;
  }

  const apiError = data.error;
  if (!apiError || typeof apiError !== "object" || !("message" in apiError)) {
    return undefined;
  }

  return typeof apiError.message === "string" && apiError.message
    ? apiError.message
    : undefined;
};
