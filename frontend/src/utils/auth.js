export function getCurrentUserRole() {
  const savedRole = localStorage.getItem("userRole");

  if (savedRole) {
    return savedRole;
  }

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
    const decoded = JSON.parse(atob(base64));

    return decoded.role || null;
  } catch (error) {
    return null;
  }
}

export function isAdminUser() {
  return getCurrentUserRole() === "admin";
}
