import { LoadingState } from "@/components/LoadingState";

export default function BillsLoading() {
  return (
    <>
      <header className="toolbar bill-entry-toolbar">
        <div>
          <h2>กรอกบิล</h2>
          <p>กำลังโหลดฟอร์มและรายการ</p>
        </div>
      </header>
      <section className="content table-view bills-view">
        <div className="panel loading-panel">
          <LoadingState title="กำลังโหลดกรอกบิล" message="กำลังดึงรายการและตัวเลือกฟอร์ม" />
        </div>
      </section>
    </>
  );
}
