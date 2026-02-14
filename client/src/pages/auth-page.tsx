import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Building2, Shield, Users, Clock } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function AuthPage() {
  const { user, loginMutation } = useAuth();
  const [, navigate] = useLocation();

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  if (user) {
    navigate("/");
    return null;
  }

  const onLogin = loginForm.handleSubmit((data) => {
    loginMutation.mutate(data);
  });

  return (
    <div className="min-h-screen flex" data-testid="auth-page">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold" data-testid="text-app-title">HRMS</h1>
            </div>
            <p className="text-muted-foreground">
              Sign in to your account
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...loginForm}>
                <form onSubmit={onLogin} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input data-testid="input-username" placeholder="Enter your username" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input data-testid="input-password" type="password" placeholder="Enter your password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    data-testid="button-login"
                    type="submit"
                    className="w-full"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-primary items-center justify-center p-12">
        <div className="max-w-md text-primary-foreground">
          <h2 className="text-3xl font-bold mb-6">
            Human Resource Management System
          </h2>
          <p className="text-primary-foreground/80 mb-8 text-lg">
            Streamline your workforce management with powerful tools for attendance tracking,
            leave management, and payroll processing.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary-foreground/10">
                <Clock className="h-5 w-5" />
              </div>
              <span>Geo-restricted attendance tracking</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary-foreground/10">
                <Users className="h-5 w-5" />
              </div>
              <span>Complete employee management</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary-foreground/10">
                <Shield className="h-5 w-5" />
              </div>
              <span>Role-based access control</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
