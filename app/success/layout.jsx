// app/success/layout.jsx
import { Suspense } from "react";

export default function SuccessLayout({ children }) {
  // Nur für diesen Route-Teil eine Suspense-Boundary setzen
  return <Suspense fallback={null}>{children}</Suspense>;
}
