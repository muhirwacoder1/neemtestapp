import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { authReturnPath } from "../chat/session";
import { useSession, useSignIn, useSignUp } from "@clerk/expo";
import { Check } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAccount } from "../services/backend";
import { useSocial } from "../services/social";
import { EntryFrame } from "../components/EntryFrame";
import { Button, T, useTheme } from "../components/ui";
import { useStartup } from "../components/Startup";
import { AccountAuth } from "../components/AccountAuth";
import { AuthField } from "../components/AuthField";
import { Captcha } from "../components/Captcha";

type Step =
  | "form"
  | "verify-up"
  | "verify-in"
  | "forgot"
  | "reset-code"
  | "new-password"
  | "secure";
function ProviderIcon({ apple = false }: { apple?: boolean }) {
  return (
    <Svg width={20} height={22} viewBox="0 0 24 24">
      {apple ? (
        <Path
          fill="#101211"
          d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.75 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.11 1.87-2.37 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.08ZM12.03 7.25C11.88 5.02 13.69 3.18 15.77 3c.28 2.58-2.34 4.5-3.74 4.25Z"
        />
      ) : (
        <>
          <Path d="M20 12h-8" fill="none" stroke="#4285F4" strokeWidth={4} />
          <Path
            d="M20 12a8 8 0 0 1-3.2 6.4"
            fill="none"
            stroke="#4285F4"
            strokeWidth={4}
          />
          <Path
            d="M16.8 18.4a8 8 0 0 1-11.7-2.4"
            fill="none"
            stroke="#34A853"
            strokeWidth={4}
          />
          <Path
            d="M5.1 16a8 8 0 0 1 0-8"
            fill="none"
            stroke="#FBBC05"
            strokeWidth={4}
          />
          <Path
            d="M5.1 8a8 8 0 0 1 12-2"
            fill="none"
            stroke="#EA4335"
            strokeWidth={4}
          />
        </>
      )}
    </Svg>
  );
}
function message(error: unknown) {
  const e = error as {
    longMessage?: string;
    errors?: { longMessage?: string }[];
  };
  return (
    e?.longMessage ||
    e?.errors?.[0]?.longMessage ||
    "We couldn’t complete this step. Check your details and try again."
  );
}
export function Auth({ signup = false }: { signup?: boolean }) {
  return useAccount().configured ? (
    <ConnectedAuth signup={signup} />
  ) : (
    <EntryFrame close={false}>
      <T size={30} weight="medium">
        Your care, connected.
      </T>
      <T style={{ marginTop: 15 }}>
        Account access is being connected. Learn about Neem while we get ready.
      </T>
      <Button
        label="About Neem"
        onPress={() => router.replace("/welcome")}
        style={{ marginTop: 24 }}
      />
    </EntryFrame>
  );
}
function ConnectedAuth({ signup }: { signup: boolean }) {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const destination = authReturnPath(returnTo);
  const c = useTheme(),
    account = useAccount(),
    intro = useStartup(),
    { session } = useSession(),
    { signIn, fetchStatus: signingIn } = useSignIn(),
    { signUp, fetchStatus: signingUp } = useSignUp(),
    social = useSocial();
  const finishIntro = intro.finish;
  const [step, setStep] = useState<Step>(() =>
    signup &&
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address")
      ? "verify-up"
      : signIn.status === "needs_new_password"
        ? "new-password"
        : "form",
  );
  const [firstName, setFirstName] = useState(intro.names.firstName),
    [lastName, setLastName] = useState(intro.names.lastName),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [remember, setRemember] = useState(false),
    [factor, setFactor] = useState<"email" | "phone" | "totp" | "backup">(
      "email",
    ),
    [sentAt, setSentAt] = useState(0);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem("@neem/remembered-email/v1")
      .then((value) => {
        if (active && value) {
          setEmail(value);
          setRemember(true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (account.signedIn && !session?.currentTask) {
      void finishIntro();
      router.replace(destination);
    }
  }, [account.signedIn, session?.currentTask, finishIntro, destination]);
  const pending = busy || signingIn === "fetching" || signingUp === "fetching";
  async function checked(promise: Promise<{ error: unknown }>) {
    const result = await promise;
    if (result.error) throw result.error;
  }
  async function finish(up = signup) {
    await checked(
      (up ? signUp : signIn).finalize({
        navigate: ({ session }) => {
          if (session?.currentTask) setStep("secure");
          else router.replace(destination);
        },
      }),
    );
    setPassword("");
    setConfirm("");
  }
  async function advanceSignIn() {
    if (signIn.status === "complete") return finish(false);
    if (signIn.status === "needs_new_password") {
      setStep("new-password");
      return;
    }
    if (
      signIn.status === "needs_second_factor" ||
      signIn.status === "needs_client_trust"
    ) {
      if (
        signIn.supportedSecondFactors.some((f) => f.strategy === "email_code")
      ) {
        await checked(signIn.mfa.sendEmailCode());
        setFactor("email");
      } else if (
        signIn.supportedSecondFactors.some((f) => f.strategy === "phone_code")
      ) {
        await checked(signIn.mfa.sendPhoneCode());
        setFactor("phone");
      } else if (
        signIn.supportedSecondFactors.some((f) => f.strategy === "totp")
      )
        setFactor("totp");
      else {
        setStep("secure");
        return;
      }
      setStep("verify-in");
      setSentAt(Date.now());
      return;
    }
    setStep("secure");
  }
  async function run(action: () => Promise<void>) {
    if (pending) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    await run(async () => {
      if (step === "form") {
        if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
          setError("Enter a valid email address.");
          return;
        }
        if (signup && !firstName.trim()) {
          setError("What should we call you? Enter your first name.");
          return;
        }
        if (!password) {
          setError("Enter your password.");
          return;
        }
        if (signup && password !== confirm) {
          setError("Your passwords don’t match.");
          return;
        }
        if (signup) {
          intro.setNames({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
          });
          if (
            signUp.status === "missing_requirements" &&
            signUp.missingFields.some(
              (f) => f === "first_name" || f === "last_name",
            )
          )
            await checked(
              signUp.update({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
              }),
            );
          else
            await checked(
              signUp.password({
                emailAddress: email.trim(),
                password,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
              }),
            );
          setPassword("");
          setConfirm("");
          if (signUp.status === "complete") await finish(true);
          else if (signUp.unverifiedFields.includes("email_address")) {
            await checked(signUp.verifications.sendEmailCode());
            setStep("verify-up");
            setSentAt(Date.now());
          } else setStep("secure");
        } else {
          await checked(
            signIn.password({ emailAddress: email.trim(), password }),
          );
          setPassword("");
          await advanceSignIn();
        }
        try {
          if (remember)
            await AsyncStorage.setItem(
              "@neem/remembered-email/v1",
              email.trim(),
            );
          else await AsyncStorage.removeItem("@neem/remembered-email/v1");
        } catch {}
      } else if (step === "verify-up") {
        await checked(
          signUp.verifications.verifyEmailCode({ code: code.trim() }),
        );
        if (signUp.status === "complete") await finish(true);
        else setStep("secure");
      } else if (step === "verify-in") {
        await checked(
          factor === "email"
            ? signIn.mfa.verifyEmailCode({ code: code.trim() })
            : factor === "phone"
              ? signIn.mfa.verifyPhoneCode({ code: code.trim() })
              : factor === "backup"
                ? signIn.mfa.verifyBackupCode({ code: code.trim() })
                : signIn.mfa.verifyTOTP({ code: code.trim() }),
        );
        await advanceSignIn();
      } else if (step === "forgot") {
        if (!email.trim()) {
          setError("Enter the email address for your account.");
          return;
        }
        await checked(signIn.create({ identifier: email.trim() }));
        await checked(signIn.resetPasswordEmailCode.sendCode());
        setStep("reset-code");
        setSentAt(Date.now());
      } else if (step === "reset-code") {
        await checked(
          signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() }),
        );
        setStep("new-password");
        setCode("");
      } else if (step === "new-password") {
        if (!password || password !== confirm) {
          setError("Enter a new password and make sure both passwords match.");
          return;
        }
        await checked(
          signIn.resetPasswordEmailCode.submitPassword({
            password,
            signOutOfOtherSessions: true,
          }),
        );
        setPassword("");
        setConfirm("");
        await advanceSignIn();
      }
    });
  }
  async function resend() {
    await run(async () => {
      if (Date.now() - sentAt < 30000) {
        setError("Please wait 30 seconds before requesting another code.");
        return;
      }
      if (step === "verify-up")
        await checked(signUp.verifications.sendEmailCode());
      else if (step === "reset-code")
        await checked(signIn.resetPasswordEmailCode.sendCode());
      else
        await checked(
          factor === "phone"
            ? signIn.mfa.sendPhoneCode()
            : signIn.mfa.sendEmailCode(),
        );
      setSentAt(Date.now());
    });
  }
  const verify = ["verify-up", "verify-in", "reset-code"].includes(step),
    showForm = step === "form";
  const title = showForm
    ? signup
      ? "Create your account"
      : "Welcome back"
    : step === "forgot"
      ? "Forgot your password?"
      : step === "new-password"
        ? "A fresh start"
        : step === "secure"
          ? "One more account step"
          : "Check your code";
  const subtitle = showForm
    ? signup
      ? "Your readings, healthier habits and a little more care. All in one place."
      : "Sign in to keep your health records and everyday care connected."
    : step === "forgot"
      ? "We’ll send a reset code to your email address."
      : step === "new-password"
        ? "Choose a new password for your Neem account."
        : step === "secure"
          ? "Finish the verification requested by your secure account."
          : factor === "totp" && step === "verify-in"
            ? "Enter the code from your authenticator app."
            : `Enter the verification code ${email ? `for ${email}` : "for your account"}.`;
  return (
    <EntryFrame
      close={false}
      footer={
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.replace({
              pathname: signup ? "/sign-in" : "/sign-up",
              params: { returnTo: destination },
            })
          }
          style={{ padding: 8 }}
        >
          <T size={14} style={{ textAlign: "center" }}>
            {signup ? "Already have an account? " : "Don’t have an account? "}
            <T weight="semibold">{signup ? "Sign in" : "Sign up"}</T>
          </T>
        </Pressable>
      }
      onBack={() => {
        if (step !== "form") {
          setStep("form");
          setError("");
          setCode("");
        } else router.replace("/welcome");
      }}
    >
      <View style={{ flex: 1, gap: 25 }}>
        <View style={{ alignItems: "center", gap: 10, marginBottom: 9 }}>
          <T
            size={33}
            weight="medium"
            style={{ letterSpacing: -1, textAlign: "center" }}
          >
            {title}
          </T>
          <T
            size={15}
            color={c.muted}
            style={{ textAlign: "center", maxWidth: 360, lineHeight: 22 }}
          >
            {subtitle}
          </T>
        </View>
        {showForm && signup && (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <AuthField
              label="First name"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
            />
            <AuthField
              label="Last name"
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
            />
          </View>
        )}
        {(showForm || step === "forgot") && (
          <AuthField
            label="Email address"
            value={email}
            onChangeText={setEmail}
            email
            placeholder="you@example.com"
          />
        )}
        {(showForm || step === "new-password") && (
          <AuthField
            label={step === "new-password" ? "New password" : "Password"}
            value={password}
            onChangeText={setPassword}
            password
            placeholder={
              signup || step === "new-password"
                ? "Use at least 15 characters"
                : "Enter your password"
            }
          />
        )}
        {((showForm && signup) || step === "new-password") && (
          <AuthField
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            password
            placeholder="Re-enter your password"
          />
        )}
      </View>
      {verify && (
        <AuthField
          label={
            factor === "backup" && step === "verify-in"
              ? "Backup code"
              : "Verification code"
          }
          value={code}
          onChangeText={setCode}
          code={factor !== "backup"}
          placeholder="Enter your code"
        />
      )}
      {showForm && !signup && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Pressable
            accessibilityRole="checkbox"
            aria-checked={remember}
            accessibilityLabel="Remember my email"
            onPress={() => setRemember((v) => !v)}
            style={{
              flexDirection: "row",
              gap: 7,
              alignItems: "center",
              paddingVertical: 5,
            }}
          >
            <View
              style={{
                width: 17,
                height: 17,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: c.blue,
                backgroundColor: remember ? c.blue : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {remember && <Check size={11} color="white" />}
            </View>
            <T size={12}>Remember my email</T>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setStep("forgot");
              setError("");
              setPassword("");
            }}
            style={{ paddingVertical: 5 }}
          >
            <T size={12} color={c.blue}>
              Forgot password?
            </T>
          </Pressable>
        </View>
      )}
      {!!error && (
        <T accessibilityRole="alert" size={13} color={c.danger}>
          {error}
        </T>
      )}
      <View>
        <Captcha />
        {step === "secure" ? (
          <AccountAuth />
        ) : (
          <Button
            label={
              showForm
                ? signup
                  ? "Sign up"
                  : "Sign in"
                : verify
                  ? "Verify code"
                  : step === "forgot"
                    ? "Send reset code"
                    : "Save new password"
            }
            onPress={submit}
            loading={pending}
            textSize={16}
            textWeight="medium"
            style={{
              backgroundColor: c.blue,
              minHeight: 58,
              borderWidth: 4,
              borderColor: c.card,
            }}
          />
        )}
        {verify && (
          <View style={{ alignItems: "center", gap: 12 }}>
            {(step !== "verify-in" ||
              factor === "email" ||
              factor === "phone") && (
              <Pressable
                accessibilityRole="button"
                onPress={resend}
                disabled={pending}
              >
                <T size={13} color={c.blue}>
                  Send another code
                </T>
              </Pressable>
            )}
            {step === "verify-in" && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setFactor(factor === "backup" ? "totp" : "backup");
                  setCode("");
                }}
              >
                <T size={13}>
                  Use {factor === "backup" ? "authenticator" : "backup"} code
                </T>
              </Pressable>
            )}
          </View>
        )}
        {showForm && (
          <>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
            >
              <View style={{ height: 1, backgroundColor: c.line, flex: 1 }} />
              <T size={12} color={c.muted}>
                or
              </T>
              <View style={{ height: 1, backgroundColor: c.line, flex: 1 }} />
            </View>
            <View style={{ gap: 12 }}>
              {[false, true].map((apple) => (
                <Pressable
                  key={String(apple)}
                  accessibilityRole="button"
                  disabled={pending}
                  onPress={() =>
                    run(async () => {
                      if (signup)
                        intro.setNames({
                          firstName: firstName.trim(),
                          lastName: lastName.trim(),
                        });
                      const proceeded = await social(
                        apple ? "oauth_apple" : "oauth_google",
                        signup,
                        destination,
                      );
                      if (proceeded === false) return;
                      if (signUp.status === "missing_requirements") {
                        router.replace({
                          pathname: "/sign-up",
                          params: { returnTo: destination },
                        });
                        return;
                      }
                      if (signIn.status && signIn.status !== "complete")
                        await advanceSignIn();
                    })
                  }
                  style={({ pressed }) => ({
                    minHeight: 55,
                    borderRadius: 36,
                    backgroundColor: c.card,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 10,
                    opacity: pressed || pending ? 0.65 : 1,
                  })}
                >
                  <ProviderIcon apple={apple} />
                  <T size={15}>Continue with {apple ? "Apple" : "Google"}</T>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
    </EntryFrame>
  );
}
