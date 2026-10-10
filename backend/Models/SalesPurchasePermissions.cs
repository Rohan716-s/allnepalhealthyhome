namespace backend.Models;

public static class SalesPurchasePermissions
{
    public const string View = "sales_purchase.view";
    public const string SalesView = "sales_purchase.sales.view";
    public const string SalesManage = "sales_purchase.sales.manage";
    public const string PurchaseView = "sales_purchase.purchase.view";
    public const string PurchaseManage = "sales_purchase.purchase.manage";
    public const string AccountsView = "sales_purchase.accounts.view";
    public const string ReceiptsManage = "sales_purchase.receipts.manage";
    public const string NotesManage = "sales_purchase.notes.manage";
    public const string JournalView = "sales_purchase.journal.view";
    public const string JournalManage = "sales_purchase.journal.manage";
    public const string Post = "sales_purchase.vouchers.post";
    public const string Unpost = "sales_purchase.vouchers.unpost";
    public const string Narration = "sales_purchase.vouchers.narration";
    public const string Print = "sales_purchase.vouchers.print";
    public static readonly (string Key, string Description, string Group)[] Definitions =
    [
        (View, "Open the Sales & Purchase workspace", "Sales & Purchase"),
        (SalesView, "View sales registers and sales reports", "Sales & Purchase"),
        (SalesManage, "Create, edit, return and reverse sales", "Sales & Purchase"),
        (PurchaseView, "View purchase registers and suppliers", "Sales & Purchase"),
        (PurchaseManage, "Receive, edit, return and reverse purchases", "Sales & Purchase"),
        (AccountsView, "View debtor accounts and collection/adjustment registers", "Account Department"),
        (ReceiptsManage, "Create and edit cash and draft receipts", "Account Department"),
        (NotesManage, "Create and edit customer and supplier credit/debit notes", "Account Department"),
        (JournalView, "View journal book, vouchers and supplier reconciliation", "Journal Voucher Section"),
        (JournalManage, "Create and edit journal, expense, payment and receipt vouchers", "Journal Voucher Section"),
        (Post, "Post saved vouchers and apply their invoice/ledger effects", "Journal Voucher Section"),
        (Unpost, "Reverse voucher effects and return vouchers to draft with an audit reason", "Journal Voucher Section"),
        (Narration, "Edit voucher narration with an audit reason", "Journal Voucher Section"),
        (Print, "Print receipts, notes, vouchers and cheques", "Journal Voucher Section")
    ];
    public static IEnumerable<string> DefaultsFor(string role)
    {
        if (role is StaffRoles.Admin or StaffRoles.Accountant) return Definitions.Select(x => x.Key);
        if (role == StaffRoles.Supervisor) return [View, SalesView, SalesManage, PurchaseView, PurchaseManage, AccountsView, JournalView, Print];
        if (role == StaffRoles.SalesManager) return [View, SalesView, SalesManage];
        if (role == StaffRoles.PurchaseInventoryManager) return [View, PurchaseView, PurchaseManage];
        return [];
    }
}
