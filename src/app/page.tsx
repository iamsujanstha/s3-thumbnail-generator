import type { Metadata } from "next";
import { ProfileForm } from "@/components/profile/ProfileForm";

export const metadata: Metadata = {
  title: "Create profile",
};

export default function HomePage() {
  return (
    <main id="main-content" className="bg-slate-50" tabIndex={-1}>
      <ProfileForm />
    </main>
  );
}
