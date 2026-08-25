import Button from '@/components/ui/button'

import {
  deleteManagedAccount,
  renameManagedAccount,
} from './account-actions'

type AccountIdentityControlsProps = {
  userId: string
  fullName: string | null
}

export default function AccountIdentityControls({
  userId,
  fullName,
}: AccountIdentityControlsProps) {
  return (
    <details className="mt-4 rounded-md border border-oxford-stone bg-oxford-off-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-oxford-charcoal">
        Account details
      </summary>

      <div className="border-t border-oxford-stone p-4">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="font-medium text-oxford-charcoal">
              Edit name
            </h4>
            <p className="mt-1 text-sm leading-6 text-oxford-ash">
              Update the display name used throughout the dashboard. The login email is unchanged.
            </p>

            <form
              action={renameManagedAccount}
              className="mt-3"
            >
              <input
                type="hidden"
                name="user_id"
                value={userId}
              />

              <label
                htmlFor={`full_name_${userId}`}
                className="mb-1 block text-sm font-medium text-oxford-charcoal"
              >
                Full name
              </label>
              <input
                id={`full_name_${userId}`}
                name="full_name"
                type="text"
                required
                maxLength={160}
                defaultValue={fullName ?? ''}
                className="w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
              />

              <Button
                type="submit"
                variant="secondary"
                className="mt-3"
              >
                Save name
              </Button>
            </form>
          </div>

          <div>
            <h4 className="font-medium text-oxford-charcoal">
              Delete account
            </h4>
            <p className="mt-1 text-sm leading-6 text-oxford-ash">
              Delete the authentication login and revoke all Viewer and Coauthor access. If the account created research notes or author records, its name-only profile is retained privately so scholarly attribution is not erased.
            </p>

            <form
              action={deleteManagedAccount}
              className="mt-3"
            >
              <input
                type="hidden"
                name="user_id"
                value={userId}
              />

              <label className="flex items-start gap-2 text-sm text-oxford-charcoal">
                <input
                  type="checkbox"
                  name="confirm_delete"
                  value="true"
                  required
                  className="mt-1 h-4 w-4 accent-oxford-blue"
                />
                <span>
                  I understand that this removes the account login and all active dashboard access.
                </span>
              </label>

              <Button
                type="submit"
                variant="danger"
                className="mt-3"
              >
                Delete account
              </Button>
            </form>
          </div>
        </div>
      </div>
    </details>
  )
}
