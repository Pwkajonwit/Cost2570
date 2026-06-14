"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, X } from "lucide-react";
import { LoadingState } from "@/components/LoadingState";
import { TABLES } from "@/lib/config";
import type { FieldSchema, RefOption, SheetRow } from "@/lib/types";

type FormPayload = {
  tableName: string;
  schema: FieldSchema[];
  initialValues: SheetRow;
  refOptions: Record<string, RefOption[]>;
};

type FormModalProps = {
  form: FormPayload;
  title?: string;
  buttonLabel?: string;
  relaxed?: boolean;
  submitPath?: string;
  openEventName?: string;
  hideLauncher?: boolean;
};

type OpenFormDetail = {
  row?: SheetRow;
  sheetRow?: number;
};

export function FormModal({ form, title = "เพิ่มข้อมูล", buttonLabel = "เพิ่มรายการ", relaxed = false, submitPath, openEventName, hideLauncher = false }: FormModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => getInitialStringValues(form));
  const [editSheetRow, setEditSheetRow] = useState<number | null>(null);
  const [enumListSearch, setEnumListSearch] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEditing = Number.isInteger(editSheetRow);
  const visibleFields = form.schema.filter(field => field.type !== "Hidden" && isFieldVisible(field, values));

  useEffect(() => {
    if (!openEventName) return;
    const openFromExternalButton = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as OpenFormDetail | undefined : undefined;
      const nextValues = detail?.row
        ? getRowStringValues(form, detail.row)
        : getInitialStringValues(form);
      applyLocalFormulas(nextValues, form.tableName);
      setError("");
      setEnumListSearch({});
      setEditSheetRow(Number.isInteger(Number(detail?.sheetRow)) ? Number(detail?.sheetRow) : null);
      setValues(nextValues);
      setOpen(true);
    };
    window.addEventListener(openEventName, openFromExternalButton as EventListener);
    return () => window.removeEventListener(openEventName, openFromExternalButton as EventListener);
  }, [form, openEventName]);

  function updateValue(field: FieldSchema, value: string) {
    setValues(current => {
      const next = { ...current, [field.name]: value };
      applyRefFill(next, field, form, value);
      normalizeDependentValues(next, field.name, form);
      applyLocalFormulas(next, form.tableName);
      return next;
    });
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submitPath) return;

    const formElement = event.currentTarget;
    const body = new FormData();
    body.set("tableName", form.tableName);
    Object.entries(values).forEach(([key, value]) => body.append(key, value));
    if (isEditing && editSheetRow !== null) body.set("sheetRow", String(editSheetRow));

    let hasFiles = false;
    formElement.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach(input => {
      Array.from(input.files || []).forEach(file => {
        if (file.size > 0) {
          hasFiles = true;
          body.append(input.name, file);
        }
      });
    });

    setSaving(true);
    setError("");
    try {
      const response = isEditing
        ? hasFiles
          ? await fetch(submitPath, {
            method: "PATCH",
            body
          })
          : await fetch(submitPath, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tableName: form.tableName, sheetRow: editSheetRow, values })
          })
        : await fetch(submitPath, {
          method: "POST",
          body
        });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "บันทึกไม่สำเร็จ");
      setOpen(false);
      setEditSheetRow(null);
      setValues(getInitialStringValues(form));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {!hideLauncher ? (
        <div className={open ? "module-bar module-bar-hidden" : "module-bar"}>
          <button type="button" className="primary module-open-button" onClick={() => setOpen(true)}>
            <Plus size={16} />
            <span>{buttonLabel}</span>
          </button>
        </div>
      ) : null}
      {open ? (
        <div className="modal-backdrop" role="presentation">
          <form className={relaxed ? "modal-card modal-card-relaxed" : "modal-card"} role="dialog" aria-modal="true" aria-labelledby="form-modal-title" aria-busy={saving} onSubmit={submitForm}>
            <header className="modal-header">
              <div>
                <h3 id="form-modal-title">{isEditing ? title.replace(/^เพิ่ม/, "แก้ไข") : title}</h3>
                <span>{form.tableName}</span>
              </div>
              <button type="button" className="icon-button" aria-label="ปิด" disabled={saving} onClick={() => { setOpen(false); setEditSheetRow(null); }}>
                <X size={18} />
              </button>
            </header>
            <div className="modal-body">
              {saving ? (
                <div className="modal-loading-overlay">
                  <LoadingState title="กำลังบันทึก" message="กำลังอัปโหลดและบันทึกข้อมูล" compact />
                </div>
              ) : null}
              <fieldset className="modal-fieldset" disabled={saving}>
                <div className="form-grid">
                  {visibleFields.map(field => (
                    <div className={getFieldClassName(field)} key={field.name}>
                      <label>{field.name}{field.required ? " *" : ""}</label>
                      {renderField(
                        field,
                        form,
                        values[field.name] || "",
                        values,
                        isEditing,
                        value => updateValue(field, value),
                        enumListSearch[field.name] || "",
                        value => setEnumListSearch(current => ({ ...current, [field.name]: value }))
                      )}
                      {field.description ? <small>{field.description}</small> : null}
                    </div>
                  ))}
                </div>
                {error ? <div className="form-error">{error}</div> : null}
              </fieldset>
            </div>
            <footer className="modal-footer">
              <button type="button" disabled={saving} onClick={() => { setOpen(false); setEditSheetRow(null); }}>ยกเลิก</button>
              <button type={submitPath ? "submit" : "button"} className="primary" disabled={saving || !submitPath}>
                <Save size={16} />
                <span>{saving ? "กำลังบันทึก" : "บันทึก"}</span>
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </>
  );
}

function renderField(
  field: FieldSchema,
  form: FormPayload,
  value: string,
  currentValues: Record<string, string>,
  isEditing: boolean,
  onChange: (value: string) => void,
  enumSearchValue = "",
  onEnumSearchChange: (value: string) => void = () => {}
) {
  const readOnly = Boolean(field.readonly || (isEditing && field.readonlyOnEdit));
  if (field.type === "Image" || field.type === "File") {
    return (
      <div className="file-control">
        <input
          type="file"
          name={field.name}
          accept={field.type === "Image" ? "image/*" : undefined}
          multiple={field.type === "Image"}
          disabled={readOnly}
        />
        {field.type === "Image" ? <small>บนมือถือเลือกถ่ายรูปหรือแนบจากเครื่องได้</small> : null}
      </div>
    );
  }

  if (field.type === "Ref" || field.type === "Enum" || field.type === "EnumList") {
    const options = getFieldOptions(field, form, currentValues);
    if (field.type === "Ref" && field.name === "ร้านค้า") {
      return (
        <SearchableRefSelect
          name={field.name}
          value={value}
          options={options}
          readOnly={readOnly}
          placeholder="พิมพ์ชื่อร้านค้า หรือรหัสร้านค้า"
          onChange={onChange}
        />
      );
    }

    if (field.type === "EnumList") {
      const selectedValues = splitEnumListValue(value);
      const optionValues = new Set(options.map(option => String(option.value)));
      const selectedOptionValues = selectedValues.filter(item => optionValues.has(item));
      const customValue = selectedValues.filter(item => !optionValues.has(item)).join(", ");
      const normalizedSearch = enumSearchValue.trim().toLowerCase();
      const filteredOptions = normalizedSearch
        ? options.filter(option => `${String(option.value)} ${String(option.label)}`.toLowerCase().includes(normalizedSearch))
        : options;

      function setSelectedValues(nextValues: string[], nextCustomValue = customValue) {
        const customItems = splitEnumListValue(nextCustomValue);
        onChange([...new Set([...nextValues, ...customItems].filter(Boolean))].join(", "));
      }

      function removeSelectedValue(selectedValue: string) {
        setSelectedValues(
          selectedOptionValues.filter(item => item !== selectedValue),
          splitEnumListValue(customValue).filter(item => item !== selectedValue).join(", ")
        );
      }

      return (
        <div className="enum-list-control">
          <input type="hidden" name={field.name} value={value} />
          <div className="enum-list-summary">
            <div className="enum-list-selected" aria-live="polite">
              {selectedValues.length ? (
                selectedValues.map((selectedValue, index) => (
                  <span className="enum-token" key={`${selectedValue}-${index}`}>
                    <span>{selectedValue}</span>
                    {!readOnly ? (
                      <button type="button" aria-label={`ลบ ${selectedValue}`} onClick={() => removeSelectedValue(selectedValue)}>
                        <X size={12} />
                      </button>
                    ) : null}
                  </span>
                ))
              ) : (
                <span className="enum-list-placeholder">ยังไม่ได้เลือก</span>
              )}
            </div>
            <span className="enum-list-count">{selectedValues.length} / {options.length}</span>
          </div>
          <input
            type="search"
            className="enum-list-search"
            value={enumSearchValue}
            readOnly={readOnly}
            placeholder="ค้นหารายละเอียดงาน"
            onChange={event => onEnumSearchChange(event.target.value)}
          />
          <div className="enum-list-options" role="group" aria-label={field.name}>
            {filteredOptions.map(option => {
              const optionValue = String(option.value);
              const checked = selectedValues.includes(optionValue);
              return (
                <label className={checked ? "enum-list-option is-active" : "enum-list-option"} key={optionValue}>
                  <input
                    type="checkbox"
                    value={optionValue}
                    checked={checked}
                    disabled={readOnly}
                    onChange={event => {
                      const nextValues = event.target.checked
                        ? [...selectedOptionValues, optionValue]
                        : selectedOptionValues.filter(item => item !== optionValue);
                      setSelectedValues(nextValues);
                    }}
                  />
                  <span>{String(option.label)}</span>
                </label>
              );
            })}
            {!filteredOptions.length ? <div className="enum-list-empty">ไม่พบรายการ</div> : null}
          </div>
          <input
            type="text"
            className="enum-list-custom"
            value={customValue}
            readOnly={readOnly}
            placeholder="เพิ่มงานอื่น คั่นด้วย comma"
            onChange={event => setSelectedValues(selectedOptionValues, event.target.value)}
          />
        </div>
      );
    }

    if (field.inputMode === "buttons") {
      const optionValues = new Set(options.map(option => String(option.value)));
      const customVatValue = field.name === "vat" && value && !optionValues.has(value) ? value : "";
      const vatChoiceValue = field.name === "vat" && customVatValue ? "ระบุเอง" : value;
      return (
        <div className={field.name === "vat" ? "choice-control choice-control-vat" : "choice-control"}>
          <div className="choice-grid" role="radiogroup" aria-label={field.name}>
            {options.map(option => {
              const optionValue = String(option.value);
              const checked = field.name === "vat" ? vatChoiceValue === optionValue : value === optionValue;
              return (
                <label className={checked ? "choice-option is-active" : "choice-option"} key={optionValue}>
                  <input
                    type="radio"
                    name={field.name}
                    value={optionValue}
                    checked={checked}
                    disabled={readOnly}
                    onClick={() => {
                      if (checked && !field.required) onChange("");
                    }}
                    onChange={event => {
                      if (field.name === "vat" && event.target.value === "ระบุเอง") {
                        onChange(customVatValue || "");
                        return;
                      }
                      onChange(event.target.value);
                    }}
                  />
                  <span>{String(option.label)}</span>
                </label>
              );
            })}
          </div>
          {field.name === "vat" && vatChoiceValue === "ระบุเอง" ? (
            <input
              type="number"
              className="choice-custom-input"
              value={customVatValue}
              readOnly={readOnly}
              placeholder="กำหนด VAT เอง"
              onChange={event => onChange(event.target.value)}
            />
          ) : null}
        </div>
      );
    }

    return (
      <select name={field.name} value={value} disabled={readOnly} onChange={event => onChange(event.target.value)}>
        <option value=""></option>
        {options.map(option => (
          <option key={String(option.value)} value={String(option.value)}>
            {String(option.label)}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "LongText") {
    return (
      <textarea
        name={field.name}
        value={value}
        readOnly={readOnly}
        rows={3}
        onChange={event => onChange(event.target.value)}
      />
    );
  }

  const type = field.type === "Date" ? "date" : field.type === "Decimal" || field.type === "Number" ? "number" : "text";
  return (
    <input
      type={type}
      name={field.name}
      value={value}
      readOnly={readOnly}
      onChange={event => onChange(event.target.value)}
    />
  );
}

function SearchableRefSelect({
  name,
  value,
  options,
  readOnly,
  placeholder,
  onChange
}: {
  name: string;
  value: string;
  options: RefOption[];
  readOnly: boolean;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const selectedLabel = optionLabel(options.find(option => String(option.value) === value));
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter(option => optionSearchText(option).includes(normalizedQuery)).slice(0, 80)
    : options.slice(0, 80);

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    setOpen(true);
    const exact = options.find(option => {
      const optionValue = String(option.value);
      const label = optionLabel(option);
      return optionValue === nextQuery || label === nextQuery;
    });
    onChange(exact ? String(exact.value) : "");
  }

  function selectOption(option: RefOption) {
    onChange(String(option.value));
    setQuery(optionLabel(option));
    setOpen(false);
  }

  return (
    <div className="searchable-ref" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <input type="hidden" name={name} value={value} />
      <input
        type="search"
        className="searchable-ref-input"
        value={query}
        readOnly={readOnly}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={event => updateQuery(event.target.value)}
      />
      {open && !readOnly ? (
        <div className="searchable-ref-menu" role="listbox" aria-label={name}>
          {filteredOptions.length ? (
            filteredOptions.map(option => {
              const optionValue = String(option.value);
              return (
                <button
                  type="button"
                  className={optionValue === value ? "searchable-ref-option is-active" : "searchable-ref-option"}
                  key={optionValue}
                  role="option"
                  aria-selected={optionValue === value}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => selectOption(option)}
                >
                  <strong>{optionLabel(option)}</strong>
                  <span>{optionValue}</span>
                </button>
              );
            })
          ) : (
            <div className="searchable-ref-empty">ไม่พบร้านค้า</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function optionLabel(option: RefOption | undefined) {
  if (!option) return "";
  return String(option.label || option.value || "");
}

function optionSearchText(option: RefOption) {
  return `${String(option.value || "")} ${optionLabel(option)}`.toLowerCase();
}

function getInitialStringValues(form: FormPayload) {
  return Object.fromEntries(form.schema.map(field => [field.name, String(form.initialValues[field.name] ?? "")]));
}

function getRowStringValues(form: FormPayload, row: SheetRow) {
  return Object.fromEntries(form.schema.map(field => [field.name, String(row[field.name] ?? form.initialValues[field.name] ?? "")]));
}

function splitEnumListValue(value: string) {
  return value.split(",").map(item => item.trim()).filter(Boolean);
}

function getFieldOptions(field: FieldSchema, form: FormPayload, values: Record<string, string>) {
  if (field.type === "Ref") {
    return filterRefOptions(field, form.refOptions[field.name] || [], values);
  }

  return getEnumValues(field, values).map(value => ({ value, label: value }));
}

function filterRefOptions(field: FieldSchema, options: RefOption[], values: Record<string, string>) {
  if (!field.filterBy) return options;
  const expectedValue = values[field.filterBy.field] || "";
  return options.filter(option => {
    if (expectedValue && String(option.row?.[field.filterBy!.column] ?? "") !== expectedValue) return false;
    if (!field.filterBy!.openContract) return true;
    return toNumber(option.row?.["ยอดเงินจ้าง"]) > toNumber(option.row?.["ยอดเงินจ่าย"]);
  });
}

function getEnumValues(field: FieldSchema, values: Record<string, string>) {
  if (field.dynamicValues !== "billTypeOptions" || !field.dynamicOptionSets) return field.values || [];
  if (values["ร้านค้า/ผู้รับเหมา"] === "ผู้รับเหมา") return field.dynamicOptionSets.contractor || field.values || [];
  if (values["สินค้า"]) return field.dynamicOptionSets.storeWithItem || field.values || [];
  return field.dynamicOptionSets.storeDefault || field.values || [];
}

function normalizeDependentValues(values: Record<string, string>, changedField: string, form: FormPayload) {
  if (changedField === "ร้านค้า/ผู้รับเหมา") {
    if (values[changedField] === "ร้านค้า") {
      values["ผู้รับเหมา"] = "";
      values["รายละเอียดงาน"] = "";
      values["ค่าแรงคงเหลือ"] = "";
    } else {
      values["ร้านค้า"] = "";
      values["สินค้า"] = "";
    }
    values["ประเภท"] = "";
  }

  if (changedField === "สินค้า") values["ประเภท"] = "";

  if (changedField === "vat" && !hasValue(values["vat"])) {
    values["วันได้บิล"] = "";
    values["เครดิต"] = "";
    values["วันจ่าย"] = "";
  }

  const typeField = form.schema.find(field => field.name === "ประเภท");
  if (typeField && values["ประเภท"] && !getEnumValues(typeField, values).includes(values["ประเภท"])) {
    values["ประเภท"] = "";
  }
}

function applyLocalFormulas(values: Record<string, string>, tableName: string) {
  if (tableName === TABLES.PROJECT) {
    if (hasValue(values["ยอดงาน"])) values["ยอดรวม vat"] = String(toNumber(values["ยอดงาน"]) * 1.07);
    return;
  }
  if (tableName !== TABLES.CONTRACT_WORK) return;
  const hireAmount = toNumber(values["ยอดเงินจ้าง"]);
  const paidAmount = toNumber(values["ยอดเงินจ่าย"]);
  if (hasValue(values["ยอดเงินจ้าง"]) || hasValue(values["ยอดเงินจ่าย"])) {
    values["ยอดเงินจ่าย"] = String(paidAmount);
    values["ค่าแรงคงเหลือ"] = String(hireAmount - paidAmount);
  }
}

function applyRefFill(values: Record<string, string>, field: FieldSchema, form: FormPayload, value: string) {
  if (field.type !== "Ref" || !field.refFill) return;
  const selectedOption = (form.refOptions[field.name] || []).find(option => String(option.value) === value);
  Object.entries(field.refFill).forEach(([targetField, sourceColumn]) => {
    values[targetField] = selectedOption ? String(selectedOption.row?.[sourceColumn] ?? "") : "";
  });
}

function isFieldVisible(field: FieldSchema, values: Record<string, string>) {
  if (!field.showIf) return true;
  const actual = values[field.showIf.column] || "";
  if (field.showIf.equals !== undefined) return actual === field.showIf.equals;
  if (field.showIf.in) return field.showIf.in.includes(actual);
  if (field.showIf.notBlank) return hasValue(actual);
  return true;
}

function getFieldClassName(field: FieldSchema) {
  const classes = ["field"];
  if (field.type === "LongText" || field.type === "Image" || field.type === "File") classes.push("field-wide");
  if (field.type === "EnumList") classes.push("field-wide field-enum-list");
  if (field.name === "ร้านค้า/ผู้รับเหมา") classes.push("field-wide field-vendor-mode");
  if (field.readonly || field.readonlyOnEdit) classes.push("field-readonly");
  if (field.required) classes.push("field-required");
  if (field.inputMode === "buttons") classes.push("field-choice");
  return classes.join(" ");
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}
