import { redirect } from "next/navigation";

export default function Home() {
  redirect("/space/@my-personal-space");
}