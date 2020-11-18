const { Provider } = require("electron-updater");

function SqlExport(editorUi){
    var tables = [];
    var primayKeys = [];
    var foreignKeys = [];
    
    function TableModel() {
        this.Name = null;
        this.Properties = []
    }

    
    function PropertyModel() {
        this.Name = null;
        this.DefaultValue = null;
        this.NotNull = true;
        this.TableName = null;
        this.ForeignKey = [];
        this.PrimaryKey = null;
        this.IsPrimaryKey = false;
        this.IsForeignKey = false;
        this.SqlType = 'varchar(255)';
    }

    function ForeignKeyModel() {
        this.PrimaryKeyName = null;
        this.ReferencesPropertyName = null

        this.PrimaryKeyTableName = null;
        this.ReferencesTableName = null;

        this.IsDestination = false;
    }

    function PrimaryKeyModel() {
        this.PrimaryKeyName = null;
        this.PrimaryKeyTableName = null;
    }

    function getTables(graph){
        var layers = graph.model.getChildCells(graph.model.root);
        if(layers.length !== 1){
            return;
        }

        (layers[0].children || []).forEach(element => {
            const table = new TableModel;
            const tableName = element.value;
            table.Name = tableName;
            element.children.forEach(propRow => {
                 const [keys, field] = propRow.children;                
                 const fieldName = field.value;

                 const prop = new PropertyModel;
                 prop.Name = fieldName; 
                 prop.TableName = tableName;

                 table.Properties.push(prop);

                 const keyNames = keys.value.split(",");

                 keyNames.forEach(keyName => {
                     if(keyName.includes("PK")){
                         const pk = new PrimaryKeyModel;
                         pk.PrimaryKeyName = `${keyName}_${fieldName}`;
                         pk.PrimaryKeyTableName = tableName
                         primayKeys.push(pk);
                         prop.IsPrimaryKey = true;
                         prop.primaryKey = pk;
                     }

                     if(keyName.includes("FK")){
                        const fk = new ForeignKeyModel;
                        fk.ReferencesPropertyName = `${keyName}_${fieldName}`;
                        fk.ReferencesTableName = tableName;
                        foreignKeys.push(fk);
                        prop.IsForeignKey = true;
                        prop.ForeignKey.push(fk);
                     }
                 })
                 
            }); 
            tables.push(table);
        });


    }

    function createTable(table){
        return `CREATE TABLE ${table.Name} (\n`;
    }

    function primaryKey(table){
        return `PRIMARY KEY (${table.Properties.filter(prop => prop.IsPrimaryKey).map(prop => prop.Name).join(', ')})`        
    }
    
    function generateTable(table){
        let ddlScript = createTable(table);
        let separator  = ''
            
        table.Properties.forEach(prop => {
            let fieldType = prop.SqlType;
            if(prop.DefaultValue != null){
                fieldType += ` DEFAULT ${prop.DefaultValue}`;
            }

            if(prop.NotNull){
                fieldType += ` NOT NULL`;
            }

            ddlScript += `${separator}    ${prop.Name} ${fieldType}`;
            separator = `,\n`;
        })

        if(table.Properties.some(prop => prop.IsPrimaryKey)){
            ddlScript += `${separator}    ${primaryKey(table)}`;
        }

        ddlScript += `\n);\n\n`;
        return ddlScript;       
           
    }

    this.exportCurrentDiagrams = function() {
        try {
            
            if (editorUi.spinner.spin(document.body, mxResources.get('exporting'))){
                
                getTables(editorUi.editor.graph);
                console.log(tables);
                console.log(primayKeys);
                console.log(foreignKeys);
                const sqlText = tables.map(generateTable).join("\n");
                console.log(sqlText);
                editorUi.spinner.stop();
                var basename = editorUi.getBaseFilename();
                editorUi.saveData(basename + ".sql", 'sql', sqlText,
                    'text/plain;charset=utf-8', false);
                
                
            }
            return true;
            
        } catch (e) {
            console.log(e);
			editorUi.spinner.stop();
			return false;
        }
        
    };
}