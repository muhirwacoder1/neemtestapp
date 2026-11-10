import React, { useState } from "react";
import { View, Switch } from "react-native";
import {
  useMutation,
  useQuery,
  usePaginatedQuery,
  useAction,
} from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { localSlotTime } from "../consultations";
import { Button, Input, T } from "../components/ui";
import {
  Section,
  Note,
  Status,
  Feedback,
  useFeedback,
  Loading,
  More,
  money,
  dateTime,
  Choices,
} from "./shared";
type Invoice = FunctionReturnType<typeof api.billing.patientInvoices>[number];
export function IssueInvoice({ profileId }: { profileId: Id<"profiles"> }) {
  const issue = useMutation(api.billing.issue),
    [description, setDescription] = useState(""),
    [amount, setAmount] = useState(""),
    [due, setDue] = useState(""),
    f = useFeedback(),
    rows = useQuery(api.billing.patientInvoices, { profileId }),
    voidInvoice = useMutation(api.billing.voidInvoice),
    [confirm, setConfirm] = useState("");
  return (
    <Section title="Patient billing">
      <Input
        label="Invoice description"
        value={description}
        maxLength={200}
        placeholder="Consultation"
        onChangeText={setDescription}
      />
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <Input
          label="Amount (RWF)"
          value={amount}
          keyboardType="number-pad"
          onChangeText={setAmount}
        />
        <Input
          label="Due date (YYYY-MM-DD)"
          value={due}
          placeholder="2026-11-01"
          onChangeText={setDue}
        />
      </View>
      <Feedback message={f.message} />
      <Button
        label="Issue RWF invoice"
        loading={f.busy}
        onPress={() =>
          void f.run(async () => {
            const dueAt = localSlotTime(due, "12:00");
            if (
              !/^\d{4}-\d{2}-\d{2}$/.test(due) ||
              !Number.isFinite(dueAt) ||
              !/^\d+$/.test(amount)
            )
              throw new Error("Enter a whole RWF amount and valid due date.");
            await issue({
              profileId,
              description,
              amountRwf: Number(amount),
              dueAt,
            });
            setDescription("");
            setAmount("");
          }, "Invoice issued to the patient.")
        }
      />
      <Note>
        Issued amounts are fixed. Void an unpaid invoice before issuing a
        correction. Latest 30 invoices shown.
      </Note>
      {rows?.map((row) => (
        <View key={row._id} style={{ gap: 10, paddingVertical: 12 }}>
          <InvoiceSummary invoice={row} />
          {row.state === "issued" &&
            (confirm === row._id ? (
              <>
                <Note>
                  Void this invoice? Pending payments prevent this action.
                </Note>
                <Button
                  small
                  label="Confirm void"
                  loading={f.busy}
                  onPress={() =>
                    void f.run(async () => {
                      await voidInvoice({ id: row._id });
                      setConfirm("");
                    }, "Invoice voided.")
                  }
                />
                <Button
                  small
                  ghost
                  label="Keep invoice"
                  onPress={() => setConfirm("")}
                />
              </>
            ) : (
              <Button
                small
                ghost
                label="Void invoice"
                onPress={() => setConfirm(row._id)}
              />
            ))}
        </View>
      ))}
    </Section>
  );
}
function InvoiceSummary({ invoice }: { invoice: Invoice }) {
  return (
    <>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <T size={19} weight="semibold">
          {money(invoice.amountRwf)}
        </T>
        <Status label={invoice.state} />
      </View>
      <T size={15}>{invoice.description}</T>
      <Note>
        Due {dateTime(invoice.dueAt)} · Invoice{" "}
        {invoice._id.slice(-8).toUpperCase()}
      </Note>
      {invoice.paidAt && (
        <Note>Payment verified {dateTime(invoice.paidAt)}</Note>
      )}
    </>
  );
}
export function BillingList({ profileId }: { profileId?: Id<"profiles"> }) {
  const rows = usePaginatedQuery(
      api.billing.invoices,
      profileId ? { profileId } : {},
      { initialNumItems: 20 },
    ),
    configuration = useQuery(api.billing.configuration),
    [selected, setSelected] = useState("");
  return (
    <Section title={profileId ? "Your invoices" : "Invoices & payments"}>
      <Note>
        Invoices are in Rwandan francs. A payment request stays pending until
        the provider confirms it.
      </Note>
      {!configuration?.enabled && (
        <Feedback message="Mobile-money checkout is awaiting the merchant account connection. Invoices can still be issued and viewed." />
      )}
      {!profileId && configuration?.enabled && <ProviderConnection />}
      {rows.status === "LoadingFirstPage" ? (
        <Loading />
      ) : !rows.results.length ? (
        <Note>No invoices yet.</Note>
      ) : (
        rows.results.map(({ invoice, patient, paymentState }) => (
          <View key={invoice._id} style={{ gap: 10, paddingVertical: 16 }}>
            {!profileId && (
              <T size={17} weight="semibold">
                {patient}
              </T>
            )}
            <InvoiceSummary invoice={invoice} />
            {paymentState && <Status label={paymentState} />}{" "}
            {profileId &&
              invoice.state === "issued" &&
              configuration?.enabled &&
              (selected === invoice._id ? (
                <Checkout
                  invoice={invoice}
                  active={
                    !!invoice.activePaymentId && paymentState !== "failed"
                  }
                />
              ) : (
                <Button
                  label={
                    invoice.activePaymentId && paymentState !== "failed"
                      ? "View payment"
                      : "Pay with mobile money"
                  }
                  secondary
                  onPress={() => setSelected(invoice._id)}
                />
              ))}
          </View>
        ))
      )}
      <More status={rows.status} loadMore={rows.loadMore} />
    </Section>
  );
}
function Checkout({ invoice, active }: { invoice: Invoice; active: boolean }) {
  const available = useAction(api.mobileMoney.available),
    checkout = useAction(api.mobileMoney.checkout),
    refresh = useAction(api.mobileMoney.refresh),
    [providers, setProviders] = useState<
      FunctionReturnType<typeof api.mobileMoney.available>
    >([]),
    [provider, setProvider] = useState(""),
    [phone, setPhone] = useState(""),
    [consent, setConsent] = useState(false),
    f = useFeedback();
  return (
    <View style={{ gap: 12 }}>
      <Feedback message={f.message} />
      {active ? (
        <>
          <Note>
            A payment request already exists. Refresh it before trying another
            payment.
          </Note>
          <Button
            label="Refresh payment status"
            loading={f.busy}
            onPress={() =>
              void f.run(
                () => refresh({ invoiceId: invoice._id }),
                "Payment status checked.",
              )
            }
          />
        </>
      ) : (
        <>
          {!providers.length ? (
            <Button
              label="Load available providers"
              secondary
              loading={f.busy}
              onPress={() =>
                void f.run(async () => {
                  const result = await available({});
                  setProviders(result);
                  if (!result.length)
                    throw new Error(
                      "No Rwanda RWF providers are enabled for this merchant.",
                    );
                }, "Choose your provider.")
              }
            />
          ) : (
            <Choices
              value={provider}
              onChange={setProvider}
              options={providers.map((p) => ({ id: p.id, label: p.name }))}
            />
          )}
          {!!provider && (
            <Note>
              Your phone prompt may show “
              {providers.find((p) => p.id === provider)?.phonePromptName}”.
              Check the amount before approving.
            </Note>
          )}
          <Input
            label="Mobile-money phone number"
            value={phone}
            keyboardType="phone-pad"
            placeholder="07…"
            maxLength={18}
            onChangeText={setPhone}
          />
          <Note>
            {providers.find((p) => p.id === provider)?.instructions ||
              "Approve the request on your phone. Never enter your PIN in Neem."}
          </Note>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Switch
              accessibilityLabel="Confirm payment authorization"
              value={consent}
              onValueChange={setConsent}
            />
            <T size={13} style={{ flex: 1 }}>
              I authorize a {money(invoice.amountRwf)} payment request to this
              phone.
            </T>
          </View>
          <Button
            label={`Request payment · ${money(invoice.amountRwf)}`}
            loading={f.busy}
            disabled={!provider || !phone || !consent}
            onPress={() =>
              void f.run(async () => {
                const message = await checkout({
                  invoiceId: invoice._id,
                  provider,
                  phone,
                  consent,
                });
                f.setMessage(message);
              }, "Payment request sent. Approve it on your phone and refresh its status.")
            }
          />
        </>
      )}
    </View>
  );
}

function ProviderConnection() {
  const available = useAction(api.mobileMoney.available),
    [names, setNames] = useState<string[]>([]),
    f = useFeedback();
  return (
    <View style={{ gap: 12 }}>
      <Status label="Checkout enabled" />
      <Feedback message={f.message} />
      {!!names.length && (
        <T size={15}>{names.join(" · ")} available for RWF payments.</T>
      )}
      <Button
        label="Check mobile-money connection"
        secondary
        loading={f.busy}
        onPress={() =>
          void f.run(async () => {
            const result = await available({});
            if (!result.length)
              throw new Error(
                "No supported RWF collection providers are configured.",
              );
            setNames(result.map((p) => p.name));
          }, "pawaPay connection verified. No payment was initiated.")
        }
      />
    </View>
  );
}
