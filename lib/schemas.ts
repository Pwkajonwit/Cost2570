import { TABLES } from "@/lib/config";
import type { FieldSchema } from "@/lib/types";

export const FORM_SCHEMAS: Record<string, FieldSchema[]> = {
  [TABLES.DATA]: [
    { name: "ลำดับ", type: "Text", key: true, initialValue: "nextDataSequence", required: true, readonlyOnEdit: true },
    { name: "ID Project", type: "Ref", refTable: TABLES.PROJECT, refKey: "ID Project", refLabel: "ชื่อ Project", validIf: "activeProjects", required: true, refFill: { "ชื่อ Project": "ชื่อ Project" } },
    { name: "ชื่อ Project", type: "Hidden" },
    { name: "ชื่อบริษัท", type: "Hidden" },
    { name: "บิล", type: "Enum", values: ["หลัก", "ย่อย"], initialValue: "ย่อย", required: true },
    { name: "ร้านค้า/ผู้รับเหมา", type: "Enum", values: ["ร้านค้า", "ผู้รับเหมา"], inputMode: "buttons", initialValue: "ร้านค้า", required: true, description: "ร้านค้า บริษัท และ หจก. : ผู้รับเหมา และนิติบุคคล" },
    { name: "ร้านค้า", type: "Ref", refTable: TABLES.STORE, refKey: "id_store", refLabel: "ชื่อร้านค้า", required: true, showIf: { column: "ร้านค้า/ผู้รับเหมา", equals: "ร้านค้า" } },
    { name: "ผู้รับเหมา", type: "Ref", refTable: TABLES.CONTRACT_WORK, refKey: "id_Conwork", refLabel: "ชื่อเล่น", required: true, showIf: { column: "ร้านค้า/ผู้รับเหมา", equals: "ผู้รับเหมา" }, filterBy: { field: "ID Project", column: "ID Project", openContract: true }, refFill: { "รายละเอียดงาน": "รายละเอียดงาน", "ค่าแรงคงเหลือ": "ค่าแรงคงเหลือ" } },
    { name: "รายละเอียดงาน", type: "Text", readonly: true, showIf: { column: "ร้านค้า/ผู้รับเหมา", equals: "ผู้รับเหมา" } },
    { name: "สินค้า", type: "Enum", values: ["เหล็กเส้น", "รูปพรรณ", "คอนกรีต", "ไม้แบบ", "วัสดุมุง", "ฝ้าผนัง", "ปูพื้น", "กระจก", "ไฟฟ้า", "ประปา", "อื่นๆ", "สีเคมี", "สุขภัณฑ์", "บิวอิน", "แอร์", "ดิน", "หินทราย", "เตรียมงาน", "non"], description: "อื่นๆคือสินค้าทั่วไป | non : 7.เครื่องมือ 8.อื่นๆ ที่พัก", showIf: { column: "ร้านค้า/ผู้รับเหมา", equals: "ร้านค้า" } },
    { name: "ประเภท", type: "Enum", values: ["1.ค่าของ", "2.ค่าแรง", "3.พนักงาน", "4.น้ำมัน", "5.ซ่อมรถ", "6.เครื่องจักร", "7.เครื่องมือ", "8.อื่นๆ"], inputMode: "buttons", required: true, dynamicValues: "billTypeOptions" },
    { name: "รูปถ่ายบิล", type: "Image", showIf: { column: "ประเภท", in: ["1.ค่าของ", "2.ค่าแรง", "3.พนักงาน", "4.น้ำมัน", "5.ซ่อมรถ", "6.เครื่องจักร", "7.เครื่องมือ", "8.อื่นๆ"] } },
    { name: "ค่าของ", type: "Decimal", required: true, showIf: { column: "ประเภท", equals: "1.ค่าของ" } },
    { name: "ชื่อเครื่องมือ", type: "EnumList", values: ["สว่านเจาะเหล็กไฟฟ้า", "สว่านเจาะปูน Rotary", "ลูกหมูขนาด 4\"", "ลูกหมูขนาด 7\"", "ไฟเบอร์ตัดเหล็ก"], required: true, showIf: { column: "ประเภท", equals: "7.เครื่องมือ" } },
    { name: "เครื่องมือ", type: "Decimal", required: true, showIf: { column: "ประเภท", equals: "7.เครื่องมือ" } },
    { name: "น้ำมัน", type: "Decimal", required: true, showIf: { column: "ประเภท", equals: "4.น้ำมัน" } },
    { name: "ซ่อมรถ", type: "Decimal", required: true, showIf: { column: "ประเภท", equals: "5.ซ่อมรถ" } },
    { name: "ทะเบียน", type: "Ref", refTable: TABLES.CAR, refKey: "id_car", refLabel: "หมายเลขทะเบียน", required: true, showIf: { column: "ประเภท", in: ["4.น้ำมัน", "5.ซ่อมรถ"] } },
    { name: "เครื่องจักร", type: "Decimal", required: true, showIf: { column: "ประเภท", equals: "6.เครื่องจักร" } },
    { name: "statusค่าแรง", type: "Enum", values: ["บุคคลธรรมดา", "บริษัท"], inputMode: "buttons", required: true, showIf: { column: "ประเภท", equals: "2.ค่าแรง" } },
    { name: "ค่าแรงคงเหลือ", type: "Decimal", readonly: true, showIf: { column: "ร้านค้า/ผู้รับเหมา", equals: "ผู้รับเหมา" } },
    { name: "อื่นๆ", type: "Decimal", required: true, showIf: { column: "ประเภท", equals: "8.อื่นๆ" } },
    { name: "รายการ", type: "Enum", values: ["ค่าที่พัก", "ห้องรายเดือน", "เงินพิเศษ"], showIf: { column: "ประเภท", equals: "8.อื่นๆ" } },
    { name: "vat", type: "Enum", values: ["1", "3", "5", "7", "ระบุเอง"], inputMode: "buttons", showIf: { column: "ประเภท", in: ["1.ค่าของ", "4.น้ำมัน", "5.ซ่อมรถ", "6.เครื่องจักร", "7.เครื่องมือ", "8.อื่นๆ"] } },
    { name: "ค่าแรง", type: "Decimal", required: true, showIf: { column: "ประเภท", equals: "2.ค่าแรง" } },
    { name: "วันได้บิล", type: "Date", showIf: { column: "vat", notBlank: true } },
    { name: "หัก", type: "Enum", values: ["1", "3", "5", "ระบุเอง"], inputMode: "buttons", description: "เลือกเปอร์เซ็นต์หัก หรือระบุเอง", showIf: { column: "ประเภท", in: ["2.ค่าแรง", "8.อื่นๆ"] } },
    { name: "จำนวนหัก", type: "Decimal", showIf: { column: "หัก", notBlank: true } },
    { name: "วันออก 3%", type: "Date", showIf: { column: "หัก", notBlank: true } },
    { name: "ชื่อพนักงาน", type: "Ref", refTable: TABLES.PEOPLE, refKey: "รหัสพนักงาน", refLabel: "ชื่อเล่น", required: true, showIf: { column: "ประเภท", equals: "3.พนักงาน" } },
    { name: "พนักงาน", type: "Decimal", required: true, showIf: { column: "ประเภท", equals: "3.พนักงาน" } },
    { name: "เครดิต", type: "Enum", values: ["30", "45", "60"], inputMode: "buttons", showIf: { column: "vat", notBlank: true } },
    { name: "วันจ่าย", type: "Date", showIf: { column: "vat", notBlank: true } },
    { name: "ผู้เบิก", type: "Ref", refTable: TABLES.PEOPLE, refKey: "รหัสพนักงาน", refLabel: "ชื่อเล่น", required: true },
    { name: "ว/ด/ป", type: "Date", initialValue: "today" },
    { name: "สถานะ", type: "Hidden", initialValue: "รออนุมัติ" },
    { name: "ยอดเงิน", type: "Hidden" },
    { name: "ร้าน/บุคคล", type: "Hidden" },
    { name: "สินค้า/ทำงาน", type: "Hidden" },
    { name: "ยอดโอน", type: "Hidden" }
  ],
  [TABLES.PROJECT]: [
    { name: "ID Project", type: "Number", key: true, initialValue: "nextProjectId", required: true, readonlyOnEdit: true },
    { name: "ชื่อ Project", type: "Text", required: true },
    {
      name: "ชื่อลูกค้า",
      type: "Ref",
      refTable: TABLES.CUSTOMER,
      refKey: "id_cus",
      refLabel: "ชื่อลูกค้า",
      refFill: { "สถานที่": "ชื่อลูกค้า" }
    },
    { name: "สถานที่", type: "Text", readonly: true },
    { name: "ยอดงาน", type: "Number", required: true },
    { name: "ยอดรวม vat", type: "Number", readonly: true },
    { name: "งบไม่เกิน", type: "Number" },
    { name: "วันที่", type: "Date", initialValue: "today" },
    { name: "color", type: "Enum", values: ["Red", "Green", "Black"], inputMode: "buttons", initialValue: "Red" },
    {
      name: "บริษัท",
      type: "Ref",
      refTable: TABLES.COMPANY,
      refKey: "id_Company",
      refLabel: "ชื่อบริษัท"
    },
    { name: "รับผิดชอบ", type: "Enum", values: ["PW1", "PW2", "PW3", "PW4", "PW"], inputMode: "dropdown" },
    {
      name: "คุมงบประเภทงาน",
      type: "Enum",
      values: ["รวมจ่ายประเภทงาน1", "รวมจ่ายประเภทงาน2", "รวมจ่ายเงิน"],
      inputMode: "buttons"
    },
    { name: "งบไม่เกินเหล็กเส้น", type: "Number", showIf: { column: "คุมงบประเภทงาน", equals: "รวมจ่ายประเภทงาน1" } },
    { name: "งบไม่เกินรูปพรรณ", type: "Number", showIf: { column: "คุมงบประเภทงาน", equals: "รวมจ่ายประเภทงาน1" } },
    { name: "งบไม่เกินคอนกรีต", type: "Number", showIf: { column: "คุมงบประเภทงาน", equals: "รวมจ่ายประเภทงาน1" } },
    { name: "งบไม่เกินไม้แบบ", type: "Number", showIf: { column: "คุมงบประเภทงาน", equals: "รวมจ่ายประเภทงาน1" } },
    { name: "งบไม่เกินวัสดุมุง", type: "Number", showIf: { column: "คุมงบประเภทงาน", equals: "รวมจ่ายประเภทงาน1" } },
    { name: "งบไม่เกินฝ้าผนัง", type: "Number", showIf: { column: "คุมงบประเภทงาน", equals: "รวมจ่ายประเภทงาน1" } },
    { name: "งบไม่เกินปูพื้น", type: "Number", showIf: { column: "คุมงบประเภทงาน", equals: "รวมจ่ายประเภทงาน1" } },
    { name: "งบไม่เกินกระจก", type: "Number", showIf: { column: "คุมงบประเภทงาน", equals: "รวมจ่ายประเภทงาน1" } },
    { name: "งบไม่เกินไฟฟ้า", type: "Number", showIf: { column: "คุมงบประเภทงาน", equals: "รวมจ่ายประเภทงาน1" } },
    { name: "งบไม่เกินประปา", type: "Number", showIf: { column: "คุมงบประเภทงาน", equals: "รวมจ่ายประเภทงาน1" } },
    { name: "งบไม่เกินอื่นๆ", type: "Number", showIf: { column: "คุมงบประเภทงาน", equals: "รวมจ่ายประเภทงาน1" } },
    { name: "งบไม่เกินสีเคมี", type: "Number", showIf: { column: "คุมงบประเภทงาน", equals: "รวมจ่ายประเภทงาน2" } },
    { name: "งบไม่เกินสุขภัณฑ์", type: "Number", showIf: { column: "คุมงบประเภทงาน", equals: "รวมจ่ายประเภทงาน2" } },
    { name: "งบไม่เกินบิวอิน", type: "Number", showIf: { column: "คุมงบประเภทงาน", equals: "รวมจ่ายประเภทงาน2" } },
    { name: "งบไม่เกินแอร์", type: "Number", showIf: { column: "คุมงบประเภทงาน", equals: "รวมจ่ายประเภทงาน2" } },
    { name: "งบไม่เกินดิน", type: "Number", showIf: { column: "คุมงบประเภทงาน", equals: "รวมจ่ายประเภทงาน2" } },
    { name: "งบไม่เกินหินทราย", type: "Number", showIf: { column: "คุมงบประเภทงาน", equals: "รวมจ่ายประเภทงาน2" } },
    { name: "งบไม่เกินเตรียมงาน", type: "Number", showIf: { column: "คุมงบประเภทงาน", equals: "รวมจ่ายประเภทงาน2" } },
    { name: "งบไม่เกินค่าของ", type: "Number", showIf: { column: "คุมงบประเภทงาน", equals: "รวมจ่ายเงิน" } },
    { name: "งบไม่เกินค่าแรง", type: "Number", showIf: { column: "คุมงบประเภทงาน", equals: "รวมจ่ายเงิน" } }
  ],
  [TABLES.BANK]: [
    { name: "id_bank", type: "Text", key: true, initialValue: "nextBankId", required: true, readonlyOnEdit: true },
    { name: "ชื่อธนาคาร", type: "Text", required: true },
    { name: "image", type: "Image" }
  ],
  [TABLES.STORE]: [
    { name: "id_store", type: "Text", key: true, initialValue: "nextStoreId", required: true, readonlyOnEdit: true },
    { name: "ชื่อร้านค้า", type: "Text", required: true },
    { name: "ชื่อเต็ม", type: "Text" },
    { name: "เลขบัญชี", type: "Text" },
    { name: "ธนาคาร", type: "Ref", refTable: TABLES.BANK, refKey: "id_bank", refLabel: "ชื่อธนาคาร" },
    { name: "เบอร์โทร", type: "Text" },
    { name: "ที่อยู่", type: "LongText" },
    { name: "เลขที่ผู้เสียภาษี", type: "Text" }
  ],
  [TABLES.CONTRACTOR]: [
    { name: "id_Contractor", type: "Text", key: true, initialValue: "nextContractorId", required: true, readonlyOnEdit: true },
    { name: "ชื่อเล่น", type: "Text", required: true },
    { name: "ชื่อ-นามสกุล", type: "Text" },
    { name: "เลขบัญชี", type: "Text" },
    { name: "ธนาคาร", type: "Ref", refTable: TABLES.BANK, refKey: "id_bank", refLabel: "ชื่อธนาคาร" },
    { name: "บัตรประจำตัวประชาชน", type: "Text" },
    { name: "เบอร์โทรศัพท์", type: "Text" },
    { name: "ที่อยู่", type: "LongText" },
    { name: "จำกัดยอด/ปี", type: "Decimal" }
  ],
  [TABLES.PEOPLE]: [
    { name: "รหัสพนักงาน", type: "Text", key: true, initialValue: "nextPeopleId", required: true, readonlyOnEdit: true },
    { name: "ชื่อเล่น", type: "Text", required: true },
    { name: "ชื่อ-นามสกุล", type: "Text" },
    { name: "เลขบัญชี", type: "Text" },
    { name: "ธนาคาร", type: "Ref", refTable: TABLES.BANK, refKey: "id_bank", refLabel: "ชื่อธนาคาร" },
    { name: "เบอร์โทร", type: "Text" },
    { name: "ที่อยู่", type: "LongText" },
    { name: "เลขที่บัตรประชาชน", type: "Text" }
  ],
  [TABLES.CAR]: [
    { name: "id_car", type: "Text", key: true, initialValue: "nextCarId", required: true, readonlyOnEdit: true },
    { name: "หมายเลขทะเบียน", type: "Text", required: true },
    { name: "ยี่ห้อรถ", type: "Text" },
    { name: "สี", type: "Text" },
    { name: "รับผิดชอบ", type: "Text" },
    { name: "รถของ", type: "Text" }
  ],
  [TABLES.CUSTOMER]: [
    { name: "id_cus", type: "Text", key: true, initialValue: "nextCustomerId", required: true, readonlyOnEdit: true },
    { name: "ชื่อลูกค้า", type: "Text", required: true },
    { name: "ที่อยู่", type: "LongText" },
    { name: "เลขที่ผู้เสียภาษี", type: "Text" }
  ],
  [TABLES.COMPANY]: [
    { name: "id_Company", type: "Text", key: true, initialValue: "nextCompanyId", required: true, readonlyOnEdit: true },
    { name: "ชื่ออังกฤษ", type: "Text" },
    { name: "ชื่อบริษัท", type: "Text", required: true },
    { name: "สำนักงาน", type: "Text" },
    { name: "ที่อยู่", type: "LongText" },
    { name: "เลขที่สียภาษี ", type: "Text" },
    { name: "เบอร์โทร", type: "Text" }
  ],
  [TABLES.LOAN]: [
    { name: "id", type: "Text", key: true, initialValue: "nextLoanId", required: true, readonlyOnEdit: true },
    { name: "ชื่อ", type: "Text", required: true },
    { name: "type", type: "Enum", values: ["ยืม", "คืน"], inputMode: "buttons" },
    { name: "จำนวนเงิน", type: "Decimal", required: true },
    { name: "วันที่", type: "Date", initialValue: "today" }
  ],
  [TABLES.CONTRACT_WORK]: [
    { name: "id_Conwork", type: "Text", key: true, initialValue: "nextContractWorkId", required: true, readonlyOnEdit: true },
    {
      name: "ID Project",
      type: "Ref",
      refTable: TABLES.PROJECT,
      refKey: "ID Project",
      refLabel: "ชื่อ Project",
      validIf: "activeProjects",
      required: true,
      refFill: {
        "ชื่อ Project": "ชื่อ Project",
        "สถานที่": "สถานที่"
      }
    },
    { name: "ชื่อ Project", type: "Text", readonly: true },
    {
      name: "id_Contractor",
      type: "Ref",
      refTable: TABLES.CONTRACTOR,
      refKey: "id_Contractor",
      refLabel: "ชื่อเล่น",
      required: true,
      refFill: {
        "ชื่อเล่น": "ชื่อเล่น",
        "ชื่อ-นามสกุล": "ชื่อ-นามสกุล",
        "เลขบัญชี": "เลขบัญชี",
        "ธนาคาร": "ธนาคาร",
        "บัตรประจำตัวประชาชน": "บัตรประจำตัวประชาชน",
        "เบอร์โทรศัพท์": "เบอร์โทรศัพท์",
        "ที่อยู่": "ที่อยู่"
      }
    },
    { name: "ชื่อเล่น", type: "Text", readonly: true },
    { name: "ชื่อ-นามสกุล", type: "Text", readonly: true },
    { name: "เลขบัญชี", type: "Text", readonly: true },
    { name: "ธนาคาร", type: "Ref", refTable: TABLES.BANK, refKey: "id_bank", refLabel: "ชื่อธนาคาร", readonly: true },
    { name: "ยอดเงินจ้าง", type: "Decimal", required: true },
    { name: "รายละเอียดงาน", type: "EnumList", values: ["งานหลังคา", "งานผูกเหล็ก"], description: "เลือกได้หลายรายการ หรือพิมพ์เพิ่มเติมได้ คั่นด้วย comma" },
    { name: "สถานที่", type: "Text", readonly: true },
    { name: "วันที่", type: "Date", initialValue: "today" },
    { name: "บัตรประจำตัวประชาชน", type: "Text", readonly: true },
    { name: "เบอร์โทรศัพท์", type: "Text", readonly: true },
    { name: "ที่อยู่", type: "LongText", readonly: true },
    { name: "ยอดเงินจ่าย", type: "Decimal", readonly: true },
    { name: "ค่าแรงคงเหลือ", type: "Decimal", readonly: true }
  ]
};

export function getFormSchema(tableName: string) {
  return FORM_SCHEMAS[tableName] || [];
}

export function getRefRowColumns(column: FieldSchema) {
  const columns: string[] = [];
  if (column.refFill) Object.values(column.refFill).forEach(value => columns.push(value));
  if (column.filterBy) {
    columns.push(column.filterBy.column);
    if (column.filterBy.openContract) columns.push("ยอดเงินจ้าง", "ยอดเงินจ่าย");
  }
  return columns;
}
