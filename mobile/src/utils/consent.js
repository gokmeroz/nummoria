// mobile/src/utils/consent.js
import AsyncStorage from "@react-native-async-storage/async-storage";

export const consentKey = (userId) => `consent:${String(userId)}`;

export async function hasAcceptedConsent(userId) {
  if (!userId) return false;

  try {
    const raw = await AsyncStorage.getItem(consentKey(userId));
    if (!raw) return false;

    const c = JSON.parse(raw);
    return !!(c?.termsAccepted && c?.cookiesAccepted);
  } catch {
    return false;
  }
}
