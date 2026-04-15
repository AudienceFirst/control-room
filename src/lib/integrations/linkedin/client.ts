import { prisma } from "@/lib/db";
import { getValidLinkedInToken } from "./token";

const LINKEDIN_API_BASE = "https://api.linkedin.com/v2";

/**
 * Fetch the total number of followers for a LinkedIn company page.
 * Uses the networkSizes endpoint which returns the firstDegreeSize (total followers).
 * Requires r_organization_social scope.
 */
export async function fetchLinkedInFollowers(clientId: string): Promise<number> {
  const connection = await prisma.linkedInConnection.findUnique({
    where: { clientId },
  });

  if (!connection) {
    throw new Error("LinkedIn not connected for this client");
  }

  const token = await getValidLinkedInToken(clientId);
  const orgUrn = encodeURIComponent(`urn:li:organization:${connection.organizationId}`);

  const res = await fetch(
    `${LINKEDIN_API_BASE}/networkSizes/${orgUrn}?edgeType=CompanyFollowedByMember`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "LinkedIn-Version": "202401",
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LinkedIn followers API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.firstDegreeSize as number;
}

/**
 * Fetch the LinkedIn company pages the authenticated user administers.
 * Used during OAuth callback to determine which org to link.
 */
export async function fetchLinkedInManagedOrgs(accessToken: string): Promise<
  Array<{ id: string; name: string }>
> {
  const res = await fetch(
    `${LINKEDIN_API_BASE}/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&count=10&projection=(elements*(organizationalTarget~(id,localizedName)))`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "LinkedIn-Version": "202401",
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LinkedIn organizationAcls API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const elements: Array<{ "organizationalTarget~"?: { id?: number; localizedName?: string } }> =
    data.elements ?? [];

  return elements
    .map((el) => {
      const org = el["organizationalTarget~"];
      if (!org?.id || !org?.localizedName) return null;
      return { id: String(org.id), name: org.localizedName };
    })
    .filter(Boolean) as Array<{ id: string; name: string }>;
}
