import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, Trash2 } from "lucide-react";

interface Props {
  id: string;
  name: string;
  color: string;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (updates: { name?: string; color?: string }) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}

const ColumnRow = ({ id, name, color, isFirst, isLast, onUpdate, onMove, onDelete }: Props) => {
  const [localName, setLocalName] = useState(name);
  const [localColor, setLocalColor] = useState(color);
  const isEditingName = useRef(false);
  const isEditingColor = useRef(false);
  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from server only when not actively editing
  useEffect(() => {
    if (!isEditingName.current) setLocalName(name);
  }, [name]);

  useEffect(() => {
    if (!isEditingColor.current) setLocalColor(color);
  }, [color]);

  const handleNameChange = (v: string) => {
    isEditingName.current = true;
    setLocalName(v);
    if (nameTimer.current) clearTimeout(nameTimer.current);
    nameTimer.current = setTimeout(() => {
      if (v.trim() && v !== name) onUpdate({ name: v.trim() });
      isEditingName.current = false;
    }, 600);
  };

  const handleColorChange = (v: string) => {
    isEditingColor.current = true;
    setLocalColor(v);
    if (colorTimer.current) clearTimeout(colorTimer.current);
    colorTimer.current = setTimeout(() => {
      if (v !== color) onUpdate({ color: v });
      isEditingColor.current = false;
    }, 400);
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded border">
      <input
        type="color"
        value={localColor}
        onChange={(e) => handleColorChange(e.target.value)}
        className="h-7 w-7 rounded cursor-pointer border-0 p-0"
      />
      <Input
        value={localName}
        onChange={(e) => handleNameChange(e.target.value)}
        onBlur={() => {
          if (localName.trim() && localName !== name) onUpdate({ name: localName.trim() });
          isEditingName.current = false;
        }}
        className="h-8 flex-1"
      />
      <Button variant="ghost" size="sm" onClick={() => onMove(-1)} disabled={isFirst}>
        <ArrowUp className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => onMove(1)} disabled={isLast}>
        <ArrowDown className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );
};

export default ColumnRow;
