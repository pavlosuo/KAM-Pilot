import { Toaster } from "sonner";

/** Page-level chrome shared by app pages: toast notifications in the light Lindström theme. */
export function AppChrome() {
  return <Toaster position="top-right" closeButton richColors theme="light" />;
}
