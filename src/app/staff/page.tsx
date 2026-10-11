import type { Metadata } from "next";
import { StaffLogin } from "@/components/StaffLogin";

export const metadata: Metadata = {
  title: "Staff portal | Ministry of Sports",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <StaffLogin />;
}
