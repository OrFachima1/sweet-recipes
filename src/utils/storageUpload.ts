import { ref, uploadBytes, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

/**
 * Upload a File or base64 data URL to Firebase Storage.
 * Returns the public download URL.
 */
export async function uploadToStorage(
  source: File | string,
  path: string
): Promise<string> {
  const storageRef = ref(storage, path);

  if (typeof source === "string") {
    await uploadString(storageRef, source, "data_url");
  } else {
    await uploadBytes(storageRef, source);
  }

  return getDownloadURL(storageRef);
}
