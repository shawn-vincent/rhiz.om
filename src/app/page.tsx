import { redirect } from "next/navigation";
import { auth } from "~/server/auth";

export default async function Home() {
	const session = await auth();

	if (!session) {
		redirect("/auth/signin");
	}

	redirect("/being/@intraliminal");
}
