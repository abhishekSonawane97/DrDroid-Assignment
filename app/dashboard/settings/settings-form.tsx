"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MODEL_PRICING } from "@/lib/model-pricing";

const PRESET_MODELS = Object.keys(MODEL_PRICING);
const CUSTOM_OPTION = "__custom__";

interface SettingsState {
  endpoint: string;
  selectedModel: string;
  maskedKey: string | null;
}

type TestResult =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "success"; modelCount: number }
  | { status: "error"; message: string };

export function SettingsForm() {
  const [loaded, setLoaded] = useState(false);
  const [endpoint, setEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<TestResult>({
    status: "idle",
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data: { configured: boolean } & Partial<SettingsState>) => {
        if (data.configured) {
          setEndpoint(data.endpoint ?? "");
          const model = data.selectedModel ?? "";
          setSelectedModel(model);
          setUseCustomModel(model !== "" && !PRESET_MODELS.includes(model));
          setMaskedKey(data.maskedKey ?? null);
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  async function save() {
    setSaveError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint, apiKey, selectedModel }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Something went wrong");
        return;
      }
      setMaskedKey(data.maskedKey);
      setApiKey(""); // clear the input; the real value is never echoed back
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTestResult({ status: "testing" });
    const saved = await save();
    if (!saved) {
      setTestResult({ status: "error", message: "Save failed" });
      return;
    }
    const res = await fetch("/api/models");
    const data = await res.json();
    if (!res.ok || data.error) {
      setTestResult({
        status: "error",
        message: data.error ?? "Could not reach the endpoint",
      });
      return;
    }
    setAvailableModels(data.models ?? []);
    setTestResult({ status: "success", modelCount: data.models?.length ?? 0 });
  }

  if (!loaded) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Endpoint</label>
        <Input
          placeholder="https://api.openai.com/v1"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">API Key</label>
        <Input
          type="password"
          placeholder={maskedKey ?? "sk-..."}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        {maskedKey && (
          <p className="text-muted-foreground text-xs">
            Current key: {maskedKey}. Leave blank to keep it.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Model</label>
        {useCustomModel ? (
          <>
            <Input
              placeholder="your-custom-model-id"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            />
            <button
              type="button"
              onClick={() => {
                setUseCustomModel(false);
                setSelectedModel("");
              }}
              className="text-muted-foreground self-start text-xs hover:underline"
            >
              Choose from list instead
            </button>
          </>
        ) : (
          <select
            value={selectedModel}
            onChange={(e) => {
              if (e.target.value === CUSTOM_OPTION) {
                setUseCustomModel(true);
                setSelectedModel("");
              } else {
                setSelectedModel(e.target.value);
              }
            }}
            className="border-input bg-background h-8 rounded-lg border px-2.5 text-sm"
          >
            <option value="" disabled>
              Select a model
            </option>
            {PRESET_MODELS.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
            <option value={CUSTOM_OPTION}>Other (enter manually)</option>
          </select>
        )}
        {availableModels.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {availableModels.map((model) => (
              <button
                key={model}
                type="button"
                onClick={() => {
                  setSelectedModel(model);
                  setUseCustomModel(!PRESET_MODELS.includes(model));
                }}
                className="bg-muted hover:bg-muted/70 rounded-md px-2 py-1 text-xs"
              >
                {model}
              </button>
            ))}
          </div>
        )}
      </div>

      {saveError && <p className="text-destructive text-sm">{saveError}</p>}

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving || !endpoint || !selectedModel}>
          Save
        </Button>
        <Button
          variant="outline"
          onClick={testConnection}
          disabled={testResult.status === "testing" || !endpoint}
        >
          Test connection
        </Button>
      </div>

      {testResult.status === "testing" && (
        <p className="text-muted-foreground text-sm">Testing…</p>
      )}
      {testResult.status === "success" && (
        <p className="text-sm text-green-600 dark:text-green-500">
          Connected — {testResult.modelCount} model
          {testResult.modelCount === 1 ? "" : "s"} available.
        </p>
      )}
      {testResult.status === "error" && (
        <p className="text-destructive text-sm">{testResult.message}</p>
      )}
    </div>
  );
}
