import { notFound } from "next/navigation";
import { MessagePerformanceFixture } from "@/components/MessagePerformanceFixture";

export default function MessagePerformancePage() {
  if (!process.env.E2E_MODE && process.env.NODE_ENV !== "development") notFound();
  return <MessagePerformanceFixture />;
}
