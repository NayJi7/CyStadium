"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Loader2, Lock, ShieldCheck, XCircle, Clock } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Status = "idle" | "submitting" | "success" | "failed" | "timeout";

type Props = {
  reservationId: string;
  amount: number;
  sessionId: string | null;
  onSuccess?: (transactionId: string) => void;
};

// Squelette de formulaire, pas de vraie passerelle de paiement (mock visuel).
// Branché sur POST /api/reservations/:id/pay (route Adam, déléguée à PaymentGateway de Fatima/Abdel).
// Tant que PaymentGateway n'existe pas côté back, la route renvoie 503 → état "failed" avec message clair.

export function PaymentForm({ reservationId, amount, sessionId, onSuccess }: Props) {
  const [card, setCard]       = useState("");
  const [holder, setHolder]   = useState("");
  const [expiry, setExpiry]   = useState("");
  const [cvc, setCvc]         = useState("");
  const [status, setStatus]   = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txId, setTxId]       = useState<string | null>(null);

  const cardClean = card.replace(/\s+/g, "");
  const expiryOk  = /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry);
  const cvcOk     = /^\d{3,4}$/.test(cvc);
  const cardOk    = /^\d{13,19}$/.test(cardClean);
  const holderOk  = holder.trim().length >= 2;
  const formValid = cardOk && expiryOk && cvcOk && holderOk && !!sessionId;

  const fieldErrors = useMemo(
    () => ({
      card:   card && !cardOk     ? "Numéro invalide"        : null,
      holder: holder && !holderOk ? "Nom trop court"         : null,
      expiry: expiry && !expiryOk ? "Format MM/AA"           : null,
      cvc:    cvc && !cvcOk       ? "3 ou 4 chiffres"        : null,
    }),
    [card, cardOk, holder, holderOk, expiry, expiryOk, cvc, cvcOk]
  );

  const formatCard = (v: string) => v.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})/g, "$1 ").trim();
  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid || !sessionId) return;
    setStatus("submitting");
    setErrorMsg(null);
    try {
      const res = await api.payReservation(reservationId, amount, sessionId);
      setTxId(res.transaction_id);
      setStatus("success");
      onSuccess?.(res.transaction_id);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 402) {
          setErrorMsg(((err.body as { reason?: string })?.reason) ?? "Paiement refusé");
          setStatus("failed");
        } else if (err.status === 504) {
          setErrorMsg("La passerelle de paiement n'a pas répondu à temps");
          setStatus("timeout");
        } else if (err.status === 503) {
          setErrorMsg("Service de paiement indisponible (PaymentGateway non démarré)");
          setStatus("failed");
        } else if (err.status === 401) {
          setErrorMsg("Session expirée, reconnecte-toi");
          setStatus("failed");
        } else {
          setErrorMsg(`Erreur ${err.status}`);
          setStatus("failed");
        }
      } else {
        setErrorMsg("Erreur réseau");
        setStatus("failed");
      }
    }
  };

  if (status === "success" && txId) {
    return (
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-6 text-center">
        <CheckCircle2 size={42} className="mx-auto text-emerald-400" />
        <h3 className="mt-3 text-lg font-bold text-white">Paiement validé</h3>
        <p className="mt-1 text-sm text-white/60">Réservation confirmée.</p>
        <p className="mt-3 text-xs font-mono text-white/40">tx: {txId}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard size={18} className="text-cyan-300" />
          <h3 className="text-base font-semibold text-white">Paiement</h3>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/60">
          <Lock size={11} /> Sécurisé par CyPay
        </span>
      </header>

      <div className="rounded-lg bg-navy-900/40 px-4 py-3">
        <div className="text-xs uppercase tracking-wider text-white/40">Montant</div>
        <div className="text-3xl font-black text-white">{amount.toFixed(2)} €</div>
      </div>

      <Input
        label="Numéro de carte"
        inputMode="numeric"
        autoComplete="cc-number"
        placeholder="4242 4242 4242 4242"
        value={card}
        onChange={(e) => setCard(formatCard(e.target.value))}
        error={fieldErrors.card}
        disabled={status === "submitting"}
      />

      <Input
        label="Titulaire"
        autoComplete="cc-name"
        placeholder="ADAM TERRAK"
        value={holder}
        onChange={(e) => setHolder(e.target.value.toUpperCase())}
        error={fieldErrors.holder}
        disabled={status === "submitting"}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Expiration"
          inputMode="numeric"
          autoComplete="cc-exp"
          placeholder="MM/AA"
          value={expiry}
          onChange={(e) => setExpiry(formatExpiry(e.target.value))}
          error={fieldErrors.expiry}
          disabled={status === "submitting"}
        />
        <Input
          label="CVC"
          inputMode="numeric"
          autoComplete="cc-csc"
          placeholder="123"
          value={cvc}
          onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
          error={fieldErrors.cvc}
          disabled={status === "submitting"}
        />
      </div>

      {errorMsg && (
        <div className={
          status === "timeout"
            ? "flex items-center gap-2 rounded-md border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-sm text-amber-200"
            : "flex items-center gap-2 rounded-md border border-red-400/30 bg-red-400/5 px-3 py-2 text-sm text-red-200"
        }>
          {status === "timeout" ? <Clock size={15} /> : <XCircle size={15} />}
          <span>{errorMsg}</span>
        </div>
      )}

      <Button type="submit" disabled={!formValid || status === "submitting"} className="w-full">
        {status === "submitting" ? (
          <><Loader2 size={16} className="animate-spin" /> Traitement…</>
        ) : (
          <><ShieldCheck size={16} /> Payer {amount.toFixed(2)} €</>
        )}
      </Button>

      {!sessionId && (
        <p className="text-center text-xs text-white/40">Connexion requise pour payer.</p>
      )}
    </form>
  );
}
