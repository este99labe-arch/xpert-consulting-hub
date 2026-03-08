import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const CreateEmployeeDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { accountId } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleCode, setRoleCode] = useState("EMPLOYEE");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");
  const [startDate, setStartDate] = useState("");
  const [ssn, setSsn] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  const resetForm = () => {
    setStep(1);
    setEmail(""); setPassword(""); setRoleCode("EMPLOYEE");
    setFirstName(""); setLastName(""); setDni(""); setPhone("");
    setDateOfBirth(""); setAddress(""); setPostalCode(""); setCity("");
    setDepartment(""); setPosition(""); setStartDate(""); setSsn("");
    setSendEmail(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (!email || !password || !firstName || !lastName) return;
      setStep(2);
      return;
    }

    setLoading(true);
    try {
      const res = await supabase.functions.invoke("admin_reset_password", {
        body: { action: "create_user", email, new_password: password, role_code: roleCode, account_id: accountId },
      });
      if (res.error || res.data?.error) throw new Error(res.data?.error || res.error?.message);

      const newUserId = res.data?.user_id;
      if (newUserId) {
        await supabase.from("employee_profiles").insert({
          user_id: newUserId, account_id: accountId!,
          first_name: firstName, last_name: lastName,
          dni: dni || null, phone: phone || null,
          date_of_birth: dateOfBirth || null, address: address || null,
          postal_code: postalCode || null, city: city || null,
          department: department || null, position: position || null,
          start_date: startDate || null, social_security_number: ssn || null,
        });
      }

      if (sendEmail) {
        let companyName = "la empresa";
        if (accountId) {
          const { data: acc } = await supabase.from("accounts").select("name").eq("id", accountId).single();
          if (acc?.name) companyName = acc.name;
        }
        await supabase.functions.invoke("send_welcome_email", {
          body: { employee_email: email, employee_name: `${firstName} ${lastName}`, password, company_name: companyName },
        });
      }

      toast({ title: "Empleado dado de alta correctamente", description: sendEmail ? "Se ha enviado un email con las credenciales" : undefined });
      queryClient.invalidateQueries({ queryKey: ["hr-employees"] });
      queryClient.invalidateQueries({ queryKey: ["hr-employee-emails"] });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dar de Alta Empleado</DialogTitle>
          <DialogDescription>
            {step === 1 ? "Paso 1: Datos de cuenta e información personal" : "Paso 2: Datos laborales y opciones"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 1 ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Juan" required />
                </div>
                <div className="space-y-2">
                  <Label>Apellidos *</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="García López" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="empleado@empresa.com" required />
                </div>
                <div className="space-y-2">
                  <Label>Contraseña *</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mín. 6 caracteres" required minLength={6} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>DNI / NIE</Label>
                  <Input value={dni} onChange={(e) => setDni(e.target.value)} placeholder="12345678A" />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 600 000 000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha de nacimiento</Label>
                  <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select value={roleCode} onValueChange={setRoleCode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPLOYEE">Empleado</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full">Siguiente →</Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle Ejemplo, 10, 2ºA" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Código postal</Label>
                  <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="28001" />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Madrid" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Administración" />
                </div>
                <div className="space-y-2">
                  <Label>Puesto</Label>
                  <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Técnico contable" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha de incorporación</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Nº Seguridad Social</Label>
                  <Input value={ssn} onChange={(e) => setSsn(e.target.value)} placeholder="28/12345678/09" />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="send-email" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="h-4 w-4 rounded border-input" />
                <Label htmlFor="send-email" className="text-sm font-normal cursor-pointer">
                  Enviar email de bienvenida con las credenciales
                </Label>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>← Atrás</Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Dar de Alta
                </Button>
              </div>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateEmployeeDialog;
