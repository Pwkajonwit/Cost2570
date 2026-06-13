import { LoadingState } from "@/components/LoadingState";

export default function ViewLoading() {
  return (
    <>
      <header className="toolbar">
        <div>
          <h2>กำลังโหลด</h2>
          <p>กำลังดึงข้อมูลหน้านี้</p>
        </div>
      </header>
      <section className="content loading-content">
        <LoadingState title="กำลังโหลดรายการ" message="กำลังอ่านข้อมูลจาก Google Sheet" />
      </section>
    </>
  );
}
