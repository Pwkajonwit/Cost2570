import { LoadingState } from "@/components/LoadingState";

export default function ViewLoading() {
  return (
    <section className="content loading-content">
      <LoadingState title="กำลังโหลดรายการ" message="กำลังอ่านข้อมูลจาก Google Sheet" />
    </section>
  );
}
