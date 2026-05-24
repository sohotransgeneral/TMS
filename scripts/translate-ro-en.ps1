# Bulk RO -> EN translation pass. Run from project root.
# Only replaces exact literal strings (case-sensitive) inside .ts/.tsx files
# under actions/, lib/, components/, app/. Safe: skips node_modules, .next, prisma/seed.

$ErrorActionPreference = "Stop"

$map = [ordered]@{
    # Generic short verbs / buttons
    'Anulează'                              = 'Cancel'
    'Salvează modificările'                 = 'Save changes'
    'Salvează'                              = 'Save'
    'Se salvează…'                          = 'Saving…'
    'Se șterge…'                            = 'Deleting…'
    'Șterge'                                = 'Delete'
    'Editează'                              = 'Edit'
    'Adaugă'                                = 'Add'
    'Confirmă'                              = 'Confirm'
    'Alocă'                                 = 'Assign'
    'Sigur ștergi factura?'                 = 'Delete this invoice?'
    'Sigur ștergi?'                         = 'Delete this item?'
    'Caută acțiune, entitate, ID…'          = 'Search action, entity, ID…'
    'Toate entitățile'                      = 'All entities'
    'Acțiune'                               = 'Action'
    'Acțiuni'                               = 'Actions'
    'Acțiunile importante vor apărea aici.' = 'Important actions will appear here.'
    'Referință'                             = 'Reference'
    'Preț'                                  = 'Price'
    'Șofer / Camion'                        = 'Driver / Truck'
    'Șofer'                                 = 'Driver'
    'Creează prima cursă pentru a o aloca unui șofer.' = 'Create the first load to assign it to a driver.'
    'Creează o cursă nouă și (opțional) alochează direct resursele.' = 'Create a new load and (optionally) assign resources directly.'
    'Pozițiile curente ale șoferilor pe curse active.' = 'Current driver positions on active loads.'
    'Săptămâna'                             = 'Week'

    # Notifications
    'Informație'                            = 'Information'
    'Mentenanță'                            = 'Maintenance'

    # Common toasts / status
    'Salvat.'                               = 'Saved.'
    'Șters.'                                = 'Deleted.'
    'Upload eșuat.'                         = 'Upload failed.'
    'Dovadă atașată ✓'                      = 'Proof attached ✓'
    'Atașează dovadă'                       = 'Attach proof'

    # Auth
    'Date invalide'                         = 'Invalid data'
    'Email sau parolă greșite.'             = 'Wrong email or password.'
    'Cont creat. Te poți autentifica.'      = 'Account created. You can log in.'
    'Parolă schimbată. Te poți autentifica.' = 'Password changed. You can log in.'
    'Dacă există un cont cu acest email, vei primi instrucțiuni.' = 'If an account exists for this email, you will receive instructions.'
    'Pentru a-ți reseta parola, accesează link-ul:' = 'To reset your password, open this link:'
    'Link-ul expiră în 1 oră.'              = 'The link expires in 1 hour.'

    # Common action errors
    'Nu ești asociat unei companii.'        = 'You are not assigned to a company.'
    'truckId lipsește.'                     = 'truckId is missing.'
    'id lipsește.'                          = 'id is missing.'
    'Camion inexistent.'                    = 'Truck not found.'
    'Camion șters.'                         = 'Truck deleted.'
    'Permit inexistent.'                    = 'Permit not found.'
    'Permit șters.'                         = 'Permit deleted.'
    'Driver inexistent.'                    = 'Driver not found.'
    'Eticheta este obligatorie.'            = 'Label is required.'
    'Ajustare inexistentă.'                 = 'Adjustment not found.'
    'Ajustare ștearsă.'                     = 'Adjustment deleted.'
    'Cheltuială inexistentă.'               = 'Expense not found.'
    'Cheltuială ștearsă.'                   = 'Expense deleted.'
    'Cheltuiala aprobată nu poate fi modificată.' = 'Approved expense cannot be modified.'
    'Cheltuiala aprobată nu poate fi ștearsă.' = 'Approved expense cannot be deleted.'
    'Factură inexistentă.'                  = 'Invoice not found.'
    'Doar facturile DRAFT/Anulate pot fi șterse.' = 'Only DRAFT/Canceled invoices can be deleted.'
    'Există plăți; nu se poate șterge.'     = 'Payments exist; cannot delete.'
    'Plată inexistentă.'                    = 'Payment not found.'
    'Plată ștearsă.'                        = 'Payment deleted.'
    'Cursă inexistentă.'                    = 'Load not found.'
    'Cursă ștearsă.'                        = 'Load deleted.'
    'Doar cursele DRAFT sau ANULATE pot fi șterse.' = 'Only DRAFT or CANCELED loads can be deleted.'
    'Acceptată de șofer'                    = 'Accepted by driver'

    # Validators
    'Parola: min 8 caractere și o cifră'    = 'Password: min 8 characters and one digit'
    'Numele companiei este obligatoriu'     = 'Company name is required'
    'Numele este obligatoriu'               = 'Name is required'
    'Cel puțin o literă mare'               = 'At least one uppercase letter'
    'Cel puțin o cifră'                     = 'At least one digit'

    # Company form
    'Logo companie'                         = 'Company logo'
    'Denumire companie'                     = 'Company name'
    'Reg. comerțului'                       = 'Trade Register'
    'Oraș'                                  = 'City'
    'Țară'                                  = 'Country'

    # Company pages
    'Date companie'                         = 'Company details'
    'Informații fiscale, bancare și setări de facturare.' = 'Tax, banking, and invoicing settings.'
    'Nicio companie înregistrată.'          = 'No company registered.'
    'Nu există nicio companie înregistrată în sistem. Înregistrează mai' = 'No company is registered in the system yet. Please register a'
    'întâi o companie.'                     = 'company first.'
    'Înregistrează companie'                = 'Register company'

    # Misc UI
    'Ștergi utilizatorul?'                  = 'Delete user?'
    'Acțiunea este ireversibilă.'           = 'This action is irreversible.'
    'Nu va mai putea autentifica până la reactivare.' = 'They will no longer be able to log in until reactivated.'
    'Va putea autentifica din nou.'         = 'They will be able to log in again.'
    'Companie'                              = 'Company'
}

$files = Get-ChildItem -Path "actions","lib","components","app" -Recurse -Include *.ts,*.tsx -File `
    | Where-Object { $_.FullName -notmatch '\\node_modules\\|\\\.next\\|\\prisma\\seed\.ts$|\\invoice-pdf\.ts$' }

$changes = 0
foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $orig = $content
    foreach ($k in $map.Keys) {
        $content = $content.Replace($k, $map[$k])
    }
    if ($content -ne $orig) {
        [System.IO.File]::WriteAllText($file.FullName, $content, (New-Object System.Text.UTF8Encoding $false))
        $changes++
        Write-Host "edited: $($file.FullName.Substring((Get-Location).Path.Length+1))"
    }
}
Write-Host "Done. Files changed: $changes"
