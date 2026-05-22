import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";

interface Props {
  title: string;
  description?: string;
  module?: string;
}

export function ComingSoon({ title, description, module: mod }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Construction className="h-5 w-5 text-amber-500" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This module {mod ? <strong>{mod}</strong> : null} is part of the
          development plan and will be available in a later release (see
          delivery plan).
        </CardContent>
      </Card>
    </div>
  );
}
