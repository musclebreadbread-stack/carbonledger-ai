import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your organization and system settings</p>
      </div>

      {/* Company Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Company Profile</CardTitle>
          <CardDescription>Basic information about your organization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input defaultValue="Sample Manufacturing Co." />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input defaultValue="Manufacturing" />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input defaultValue="South Korea" />
            </div>
            <div className="space-y-2">
              <Label>Registration Number</Label>
              <Input defaultValue="123-45-67890" />
            </div>
          </div>
          <Button>Save Changes</Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Emission Factor Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Emission Factor Version</CardTitle>
          <CardDescription>Select which emission factor database to use for calculations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Active Provider</Label>
            <select className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="korea_moe_2023">Korea MOE 2023</option>
              <option value="ipcc_2006">IPCC 2006 Guidelines</option>
              <option value="defra_2023">UK DEFRA 2023</option>
            </select>
          </div>
          <Button variant="outline">Apply to All Calculations</Button>
        </CardContent>
      </Card>

      <Separator />

      {/* User Management */}
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>Manage team members and their roles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {["admin@company.com (Company Admin)", "reviewer@company.com (Reviewer)", "auditor@company.com (Auditor)"].map((user, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">{user}</span>
                <Button variant="outline" size="sm">Edit Role</Button>
              </div>
            ))}
          </div>
          <Button className="mt-4" variant="outline">+ Invite User</Button>
        </CardContent>
      </Card>
    </div>
  );
}
