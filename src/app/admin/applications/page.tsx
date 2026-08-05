import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPendingApplications } from "@/modules/admin/queries";
import {
  approveAgencyApplication,
  rejectAgencyApplication,
  approveHotelPartnerApplication,
  rejectHotelPartnerApplication,
  approveAffiliateApplication,
  rejectAffiliateApplication,
} from "@/modules/admin/actions";
import { ApplicationActions } from "./application-actions";

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
        No pending applications.
      </TableCell>
    </TableRow>
  );
}

export default async function AdminApplicationsPage() {
  const { agency, partner, affiliate } = await getPendingApplications();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Applications</h1>
        <p className="text-sm text-muted-foreground">Review pending agency, hotel partner, and affiliate applications.</p>
      </div>

      <Tabs defaultValue="agency">
        <TabsList>
          <TabsTrigger value="agency">Agencies ({agency.length})</TabsTrigger>
          <TabsTrigger value="partner">Hotel Partners ({partner.length})</TabsTrigger>
          <TabsTrigger value="affiliate">Affiliates ({affiliate.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="agency" className="mt-4">
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Agency name</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agency.length === 0 ? (
                  <EmptyRow colSpan={4} />
                ) : (
                  agency.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <p className="font-medium">{app.applicant?.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{app.applicant?.email}</p>
                      </TableCell>
                      <TableCell>{app.agency_name}</TableCell>
                      <TableCell>{new Date(app.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <ApplicationActions
                          applicationId={app.id}
                          approveAction={approveAgencyApplication}
                          rejectAction={rejectAgencyApplication}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="partner" className="mt-4">
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Business name</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partner.length === 0 ? (
                  <EmptyRow colSpan={4} />
                ) : (
                  partner.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <p className="font-medium">{app.applicant?.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{app.applicant?.email}</p>
                      </TableCell>
                      <TableCell>{app.business_name}</TableCell>
                      <TableCell>{new Date(app.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <ApplicationActions
                          applicationId={app.id}
                          approveAction={approveHotelPartnerApplication}
                          rejectAction={rejectHotelPartnerApplication}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="affiliate" className="mt-4">
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {affiliate.length === 0 ? (
                  <EmptyRow colSpan={4} />
                ) : (
                  affiliate.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <p className="font-medium">{app.applicant?.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{app.applicant?.email}</p>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {app.notes || "—"}
                      </TableCell>
                      <TableCell>{new Date(app.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <ApplicationActions
                          applicationId={app.id}
                          approveAction={approveAffiliateApplication}
                          rejectAction={rejectAffiliateApplication}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
