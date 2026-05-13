function getDecodedTokenPayload() {
  const token = localStorage.getItem("token");

  if (!token) {
    return null;
  }

  try {
    const payloadPart = token.split(".")[1];

    if (!payloadPart) {
      return null;
    }

    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch (error) {
    return null;
  }
}

export function getCurrentUserRole() {
  const savedRole = localStorage.getItem("userRole");

  if (savedRole) {
    return savedRole;
  }

  const decoded = getDecodedTokenPayload();
  return decoded?.role || null;
}

export function getCurrentUsername() {
  const decoded = getDecodedTokenPayload();
  return decoded?.username || null;
}

export function isAdminUser() {
  return getCurrentUserRole() === "admin";
}
