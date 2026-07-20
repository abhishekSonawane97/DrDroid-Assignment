"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PaywallForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  async function redeemCoupon() {
    setCouponError(null);
    setCouponLoading(true);
    try {
      const res = await fetch("/api/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCouponError(data.error ?? "Something went wrong");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setCouponLoading(false);
    }
  }

  return (
    <div className="flex w-80 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Input
          placeholder="Coupon code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Button onClick={redeemCoupon} disabled={couponLoading || !code}>
          Redeem coupon
        </Button>
        {couponError && (
          <p className="text-destructive text-sm">{couponError}</p>
        )}
      </div>

      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <div className="bg-border h-px flex-1" />
        or
        <div className="bg-border h-px flex-1" />
      </div>

      <div className="flex flex-col gap-2">
        <Button disabled variant="outline">
          Pay with card
        </Button>
        <p className="text-muted-foreground text-center text-sm">
          Payment integration coming soon.
        </p>
      </div>
    </div>
  );
}
