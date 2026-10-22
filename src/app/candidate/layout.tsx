import { ReactNode } from "react";

export const metadata = { title: "Candidate · ReqCore" };

export default function CandidateLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl py-4">
      {children}
    </div>
  );
}
