import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { toast } from "sonner";
import { CitySearch, type CityValue } from "@/design-system/ventura-6bef42/components/CitySearch";

type InvestorType = "angel" | "vc";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  investor_type: z.enum(["angel", "vc"], { message: "Select an option" }),
  vc_fund: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().min(1, "Select your city").max(120),
  country: z.string().trim().min(1, "Select your city").max(120),
}).refine(
  (d) => d.investor_type !== "vc" || (d.vc_fund && d.vc_fund.trim().length > 0),
  { path: ["vc_fund"], message: "Fund name is required" }
);

export function WaitlistForm() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [investorType, setInvestorType] = useState<InvestorType | "">("");
  const [location, setLocation] = useState<CityValue | null>(null);


  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      name: fd.get("name"),
      email: fd.get("email"),
      phone: fd.get("phone"),
      investor_type: fd.get("investor_type"),
      vc_fund: fd.get("vc_fund"),
      city: location?.city ?? "",
      country: location?.country ?? "",
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        errs[i.path[0] as string] = i.message;
      });
      setErrors(errs);
      return;
    }

    setLoading(true);
    const fundLabel =
      parsed.data.investor_type === "angel"
        ? "Angel"
        : parsed.data.vc_fund || null;

    const { error } = await supabase.from("waitlist").insert({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      vc_fund: fundLabel,
      city: parsed.data.city,
      country: parsed.data.country,
    });
    setLoading(false);

    if (error) {
      toast.error("Something went wrong. Please try again.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
          <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-base font-medium text-foreground">
          Thanks — you're on the Ventura waitlist.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          We'll be in touch soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <Field label="Name" name="name" type="text" placeholder="Your name" required autoComplete="name" error={errors.name} />
      <Field label="Email" name="email" type="email" placeholder="you@fund.com" required autoComplete="email" error={errors.email} />
      <Field label="Phone" name="phone" type="tel" placeholder="Optional" autoComplete="tel" error={errors.phone} />

      <div className="block">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Location <span className="text-primary">*</span>
        </span>
        <CitySearch value={location} onChange={setLocation} placeholder="Search your city…" />
        {(errors.city || errors.country) && (
          <span className="mt-1 block text-xs text-destructive">{errors.city || errors.country}</span>
        )}
      </div>

      <div className="block">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          You are <span className="text-primary">*</span>
        </span>
        <div className="grid grid-cols-2 gap-2">
          {(["angel", "vc"] as const).map((opt) => {
            const active = investorType === opt;
            return (
              <label
                key={opt}
                className={`cursor-pointer rounded-xl border px-4 py-3.5 text-center text-base transition ${
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="investor_type"
                  value={opt}
                  className="sr-only"
                  checked={active}
                  onChange={() => setInvestorType(opt)}
                />
                {opt === "angel" ? "Angel" : "VC"}
              </label>
            );
          })}
        </div>
        {errors.investor_type && (
          <span className="mt-1 block text-xs text-destructive">{errors.investor_type}</span>
        )}
      </div>

      {investorType === "vc" && (
        <Field label="VC fund name" name="vc_fund" type="text" placeholder="Your fund" required error={errors.vc_fund} />
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 w-full rounded-xl bg-primary px-5 py-4 text-base font-semibold text-primary-foreground transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
      >
        {loading ? "Joining…" : "Join the waitlist"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
  required,
  autoComplete,
  error,
}: {
  label: string;
  name: string;
  type: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="text-primary"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-xl border border-border bg-card px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
      />
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}
