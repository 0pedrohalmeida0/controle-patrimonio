import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ScanLine, LogIn, UserPlus, Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { t } from "@/lib/i18n";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Mode = "signIn" | "signUp";

export default function AuthRoute() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "signIn") {
        await signIn(email, password);
      } else {
        await signUp(email, password, name);
      }
    },
    onSuccess: () => {
      if (mode === "signUp") {
        toast.success(t("auth.signUp.success"));
        // Voltar para o sign-in para que o usuário entre explicitamente.
        setMode("signIn");
        setPassword("");
        return;
      }
      navigate("/", { replace: true });
    },
    onError: (err: Error) => {
      toast.error(err.message || t("auth.signIn.invalid"));
    },
  });

  const isSignIn = mode === "signIn";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-foreground text-background">
            <ScanLine className="h-6 w-6" />
          </div>
          <CardTitle>{t(isSignIn ? "auth.signIn.title" : "auth.signUp.title")}</CardTitle>
          <CardDescription>
            {t(isSignIn ? "auth.signIn.subtitle" : "auth.signUp.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="space-y-3"
          >
            {!isSignIn && (
              <div className="space-y-2">
                <Label htmlFor="name">{t("auth.signUp.name")}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">
                {t(isSignIn ? "auth.signIn.email" : "auth.signUp.email")}
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">
                {t(isSignIn ? "auth.signIn.password" : "auth.signUp.password")}
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={isSignIn ? "current-password" : "new-password"}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isSignIn ? (
                <LogIn className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {t(isSignIn ? "auth.signIn.submit" : "auth.signUp.submit")}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground hover:underline"
              onClick={() => {
                setMode(isSignIn ? "signUp" : "signIn");
                setPassword("");
              }}
            >
              {isSignIn
                ? t("auth.signIn.signup")
                : t("auth.signUp.haveAccount")}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
